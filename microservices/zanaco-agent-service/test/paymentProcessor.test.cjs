const test = require('node:test');
const assert = require('node:assert/strict');
const { processPaymentJob } = require('../dist/paymentProcessor');
const copy = value => JSON.parse(JSON.stringify(value));
const prepared = { service: 'ZANACO_RTGS', endpoint: '/payment', method: 'POST', externalTranRef: 'REF1234567890123', request: { amount: '10' } };
const paid = { success: true, status: 200, data: { response: { tranRefNo: 'BANK1' } } };
const unknown = { success: false, status: 200, unknown: true, error: 'ZWS-51' };

function fixture() {
  let stored = { payment: { paymentId: 'SAGE1' }, queueId: 'queue1', reportToPortal: true };
  const calls = { submit: 0, reconcile: 0, report: [] };
  const operations = {
    prepare: () => copy(prepared),
    submit: async () => { calls.submit++; return paid; },
    reconcile: async () => { calls.reconcile++; return paid; },
    report: async (_, result) => { calls.report.push(copy(result)); },
  };
  const job = (attemptsMade = 0) => ({
    data: copy(stored), attemptsMade,
    updateData: async data => { stored = copy(data); },
  });
  return { operations, calls, job, stored: () => copy(stored) };
}

test('portal failure after bank success retries only reporting after process restart', async () => {
  const f = fixture();
  let failures = 1;
  f.operations.report = async (_, result) => {
    f.calls.report.push(copy(result));
    if (failures-- > 0) throw new Error('Portal unavailable');
  };
  await assert.rejects(processPaymentJob(f.job(), f.operations), /Portal unavailable/);
  assert.equal(f.stored().checkpoint.result.success, true);
  assert.equal((await processPaymentJob(f.job(1), f.operations)).success, true);
  assert.equal(f.calls.submit, 1);
  assert.equal(f.calls.reconcile, 0);
  assert.equal(f.calls.report.length, 2);
});

test('authentication failure stays before the submission boundary and resumes once credentials work', async () => {
  const f = fixture();
  let authCalls = 0, markers = 0;
  f.operations.authorize = async () => { if (++authCalls === 1) throw new Error('ENOTFOUND'); };
  f.operations.beginSubmission = async () => { markers++; return true; };
  await assert.rejects(processPaymentJob(f.job(), f.operations), /ENOTFOUND/);
  assert.equal(f.stored().checkpoint.phase, 'prepared');
  assert.equal(f.stored().checkpoint.result.notSent, true);
  assert.equal(markers, 0);
  assert.equal(f.calls.submit, 0);
  assert.equal((await processPaymentJob(f.job(1), f.operations)).success, true);
  assert.equal(markers, 1);
  assert.equal(f.calls.submit, 1);
});

test('validation rejection fences a stalled worker before recording not-sent proof', async () => {
  const f = fixture();
  let validations = 0, started = false;
  f.operations.prepare = () => { if (++validations === 1) throw new Error('Invalid beneficiary'); return prepared; };
  f.operations.beginSubmission = async () => { if (started) return false; started = true; return true; };
  f.operations.reconcile = async () => { f.calls.reconcile++; return unknown; };
  await Promise.allSettled([processPaymentJob(f.job(), f.operations), processPaymentJob(f.job(), f.operations)]);
  assert.equal(f.calls.submit, 0);
  assert.equal(f.calls.reconcile, 1);
});

test('lost submission response and repeated ZWS-51 retry only status enquiries', async () => {
  const f = fixture();
  f.operations.submit = async () => { f.calls.submit++; throw new Error('Connection reset'); };
  f.operations.reconcile = async original => {
    assert.deepEqual(original, prepared);
    return ++f.calls.reconcile === 1 ? unknown : paid;
  };
  await assert.rejects(processPaymentJob(f.job(), f.operations), /Connection reset/);
  await assert.rejects(processPaymentJob(f.job(1), f.operations), /ZWS-51/);
  assert.equal((await processPaymentJob(f.job(2), f.operations)).success, true);
  assert.equal(f.calls.submit, 1);
  assert.equal(f.calls.reconcile, 2);
});

test('crash after bank call but before saving outcome recovers the original identity via status', async () => {
  const f = fixture();
  const job = f.job();
  const save = job.updateData;
  job.updateData = async data => {
    if (data.checkpoint.phase === 'outcome') throw new Error('Redis write failed');
    await save(data);
  };
  await assert.rejects(processPaymentJob(job, f.operations), /Redis write failed/);
  assert.equal(f.stored().checkpoint.phase, 'submitting');
  assert.equal((await processPaymentJob(f.job(1), f.operations)).success, true);
  assert.equal(f.calls.submit, 1);
  assert.equal(f.calls.reconcile, 1);
});

test('no bank call is made if the pre-submission checkpoint cannot be persisted', async () => {
  const f = fixture();
  const job = f.job();
  const save = job.updateData;
  job.updateData = async data => {
    if (data.checkpoint.phase === 'submitting') throw new Error('Redis unavailable');
    await save(data);
  };
  await assert.rejects(processPaymentJob(job, f.operations), /Redis unavailable/);
  assert.equal(f.calls.submit, 0);
  assert.equal((await processPaymentJob(f.job(1), f.operations)).success, true);
  assert.equal(f.calls.submit, 1);
});

test('uncertainty stays unknown when the retry budget is exhausted', async () => {
  const f = fixture();
  f.operations.submit = async () => { f.calls.submit++; return unknown; };
  f.operations.reconcile = async () => { f.calls.reconcile++; return unknown; };
  for (let attempt = 0; attempt < 3; attempt++) {
    await assert.rejects(processPaymentJob(f.job(attempt), f.operations), /ZWS-51/);
  }
  assert.equal(f.stored().checkpoint.result.unknown, true);
  assert.ok(f.calls.report.every(result => result.unknown));
  assert.equal(f.calls.submit, 1);
});

test('legacy retries without checkpoints are held for manual reconciliation', async () => {
  const f = fixture();
  f.operations.prepare = () => { throw new Error('Should not rebuild an old bank identity'); };
  await assert.rejects(processPaymentJob(f.job(1), f.operations), /Legacy job/);
  await assert.rejects(processPaymentJob(f.job(2), f.operations), /Legacy job/);
  assert.equal(f.calls.submit, 0);
  assert.equal(f.calls.reconcile, 0);
  assert.equal(f.calls.report[0].unknown, true);
});

test('reference collisions reject a new instruction before contacting the bank', async () => {
  const f = fixture();
  f.operations.reserve = async () => { throw new Error('Reference already reserved'); };
  assert.equal((await processPaymentJob(f.job(), f.operations)).status, 409);
  assert.equal((await processPaymentJob(f.job(1), f.operations)).status, 409);
  assert.equal(f.calls.submit, 0);
  assert.equal(f.calls.reconcile, 0);
});

test('overlapping workers can only cross the atomic submission gate once', async () => {
  const f = fixture();
  let started = false;
  f.operations.beginSubmission = async () => {
    if (started) return false;
    started = true;
    return true;
  };
  await Promise.all([processPaymentJob(f.job(), f.operations), processPaymentJob(f.job(), f.operations)]);
  assert.equal(f.calls.submit, 1);
  assert.equal(f.calls.reconcile, 1);
});

test('accepted bulk payments remain accepted on recovery and are not resubmitted', async () => {
  const f = fixture();
  const accepted = { success: false, status: 202, accepted: true, data: { batchReference: 'BANKBATCH1' } };
  f.operations.submit = async () => { f.calls.submit++; return accepted; };
  f.operations.reconcile = async (_, previous) => { f.calls.reconcile++; assert.deepEqual(previous, accepted); return accepted; };
  await assert.rejects(processPaymentJob(f.job(), f.operations), /awaits bank confirmation/);
  await assert.rejects(processPaymentJob(f.job(1), f.operations), /awaits bank confirmation/);
  assert.equal(f.calls.submit, 1);
  assert.ok(f.calls.report.every(result => result.accepted && !result.success));
});
