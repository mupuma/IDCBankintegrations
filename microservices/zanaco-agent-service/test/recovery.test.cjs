const test = require('node:test');
const assert = require('node:assert/strict');
const { applyRecoveryCommand } = require('../dist/recovery');
const { load } = require('./helpers/portal.cjs');
const { recoveryActions, correctedPayment } = load('idcbanksinegration/app/lib/paymentRecoveryPolicy.ts');

function fixture(checkpoint, state = 'failed', started = false) {
  const calls = { retries: 0, reports: 0, promotes: 0 };
  const job = { data: { checkpoint }, attemptsMade: 10,
    getState: async () => state,
    retry: async (value, options) => { assert.ok(['failed', 'completed'].includes(value)); assert.equal(options.resetAttemptsMade, true); calls.retries++; },
    promote: async () => { calls.promotes++; },
  };
  const operations = { find: async () => job, submissionStarted: async () => started, report: async () => { calls.reports++; } };
  return { operations, calls, run: action => applyRecoveryCommand({ queueId: 'Q1', action }, operations) };
}

test('connection recovery requires a prepared checkpoint, not-sent proof and no submission marker', async () => {
  const checkpoint = { phase: 'prepared', result: { notSent: true, retryable: true } };
  const f = fixture(checkpoint);
  await f.run('retry_connection');
  assert.equal(f.calls.retries, 1);
  for (const blocked of [fixture(checkpoint, 'failed', true), fixture({ phase: 'submitting' }), fixture({ phase: 'outcome', result: { unknown: true } })]) {
    await assert.rejects(blocked.run('retry_connection'), /No proof/);
    assert.equal(blocked.calls.retries, 0);
  }
});

test('unknown recovery schedules the existing job; reporting recovery only replays its result', async () => {
  const f = fixture({ phase: 'outcome', prepared: { externalTranRef: 'ORIGINAL' }, result: { unknown: true } });
  await f.run('check_status');
  assert.equal(f.calls.retries, 1);
  const reporting = fixture({ phase: 'outcome', result: { success: true } }, 'completed');
  await reporting.run('retry_reporting');
  assert.equal(reporting.calls.retries, 0);
  assert.equal(reporting.calls.reports, 1);
});

test('missing Redis jobs and legacy checkpoints cannot be recreated by recovery commands', async () => {
  const f = fixture(undefined);
  await assert.rejects(f.run('check_status'), /Legacy/);
  f.operations.find = async () => undefined;
  await assert.rejects(f.run('check_status'), /missing from Redis/);
  assert.equal(f.calls.retries, 0);
});

test('active jobs are not duplicated and delayed reconciliation can be promoted', async () => {
  const checkpoint = { phase: 'submitting', prepared: { externalTranRef: 'ORIGINAL' }, result: { unknown: true } };
  const active = fixture(checkpoint, 'active');
  await active.run('check_status');
  assert.equal(active.calls.retries, 0);
  const delayed = fixture(checkpoint, 'delayed');
  await delayed.run('check_status');
  assert.equal(delayed.calls.promotes, 1);
});

test('paid, uncertain and legacy outcomes cannot authorise a new attempt', () => {
  for (const bank of ['ZANACO', 'ZICB']) {
    for (const status of ['success', 'paid', 'unknown', 'accepted', 'processing', 'needs_review']) {
      assert.equal(recoveryActions(bank, status, { confirmedRejected: true }).includes('new_attempt'), false);
    }
    assert.equal(recoveryActions(bank, 'failed').includes('new_attempt'), false);
    assert.equal(recoveryActions(bank, 'failed', { confirmedRejected: true }).includes('new_attempt'), true);
    assert.equal(recoveryActions(bank, 'failed', { notSent: true, retryable: true }).includes('new_attempt'), false);
  }
  assert.deepEqual(recoveryActions('ZICB', 'paid', {}, 'retry'), ['retry_accounting']);
});

test('corrected attempts cannot change amount, currency, payment ID, source or channel', () => {
  const original = { paymentId: 'SAGE1', amount: 10, currency: 'ZMW', transactionType: 'RTGS' };
  for (const field of ['paymentId', 'amount', 'currency', 'transactionType', 'srcAcc', 'sourceBank', 'recoveryAttemptId']) {
    assert.throws(() => correctedPayment(original, { [field]: 'changed' }), /Cannot change/);
  }
  const changed = correctedPayment(original, { accountNumber: ' 0012345678901 ', tpin: '1234567890', physicalAddress: { town: 'Lusaka' } });
  assert.equal(changed.amount, 10);
  assert.equal(changed.accountNumber, '0012345678901');
  assert.equal(original.accountNumber, undefined);
});
