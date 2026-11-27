const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/portal.cjs');

function fixture(stages, bankCode = 'ZICB', configured = true) {
  const workflow = { version: 'VERSION', name: 'Supplier payments', bankCode, sourceBank: '', stages };
  const row = { queueId: 'Q1', bankCode, status: 'awaiting_approval', save: async () => {},
    paymentPayload: JSON.stringify(bankCode === 'ZICB' ? { h2hProtocol: 'h2h-v1' } : {}) };
  const ledger = { state: row.status, nextRun: null, update: async values => Object.assign(ledger, values) };
  const audits = [];
  let tail = Promise.resolve();
  const approvals = load('idcbanksinegration/app/lib/paymentApprovals.ts', {
    'sequelize': { Op: { in: Symbol('in') } },
    './db': { getSequelize: async () => ({ transaction: run => {
      const operation = tail.then(() => run({ LOCK: { UPDATE: 'UPDATE' } }));
      tail = operation.catch(() => {});
      return operation;
    } }) },
    '../models/internal/ApprovalWorkflow': {
      ApprovalWorkflow: { findAll: async () => configured ? [{ scope: bankCode + ':', definition: JSON.stringify(workflow) }] : [] },
    },
    '../models/internal/AuditLog': { AuditLog: { create: async values => audits.push(values) } },
    '../models/internal/PaymentQueueRequest': { PaymentQueueRequest: { findOne: async () => row } },
    '../models/internal/User': { User: { findAll: async () => [1, 2, 3, 4].map(id => ({ id })) } },
    '../models/internal/ZicbH2hPayment': { ZicbH2hPayment: { findByPk: async () => ledger } },
  });
  return {
    ...approvals, row, ledger, audits,
    prepare: async () => Object.assign(row, await approvals.preparePaymentApproval(bankCode, null, 1)),
    decide: (stage, id, action = 'approve', version = 'VERSION') => approvals.decidePayment(
      'Q1', version, stage, action, 'Reviewed', { id, username: 'user' + id },
    ),
  };
}
const stage = (name, approverIds, required = 1) => ({ name, approverIds, required });

test('ZICB waits for all stages and distinct approvers, and bars the creator at every multi-stage step', async () => {
  const f = fixture([stage('Finance', [1, 2, 3], 2), stage('Treasury', [1, 4])]);
  await f.prepare();
  await assert.rejects(f.decide(0, 1), { status: 403 });
  await assert.rejects(f.decide(1, 4), { status: 409 });
  await assert.rejects(f.decide(0, 2, 'approve', 'STALE'), { status: 409 });
  const attempts = await Promise.allSettled([f.decide(0, 2), f.decide(0, 2)]);
  assert.deepEqual(attempts.map(result => result.status), ['fulfilled', 'rejected']);
  assert.equal(f.row.status, 'awaiting_approval');
  await f.decide(0, 3);
  assert.equal(f.row.status, 'awaiting_approval');
  assert.equal(f.ledger.nextRun, null);
  await assert.rejects(f.decide(1, 1), { status: 403 });
  await f.decide(1, 4);
  assert.equal(f.row.status, 'queued');
  assert.equal(f.ledger.state, 'queued');
  assert.ok(f.ledger.nextRun instanceof Date);
  assert.equal(f.audits.length, 3);
});

test('a listed creator may approve a single-stage payment', async () => {
  const f = fixture([stage('Finance', [1])], 'IZB');
  await f.prepare();
  await f.decide(0, 1);
  assert.equal(f.row.status, 'queued');
});

test('rejection is terminal and leaves the ledger unscheduled', async () => {
  const f = fixture([stage('Finance', [2])]);
  await f.prepare();
  await f.decide(0, 2, 'reject');
  assert.equal(f.row.status, 'approval_rejected');
  assert.equal(f.ledger.state, 'approval_rejected');
  assert.equal(f.ledger.nextRun, null);
  await assert.rejects(f.decide(0, 2), { status: 409 });
});

test('missing workflows or stages without enough eligible approvers block submission', async () => {
  await assert.rejects(fixture([], 'IZB', false).prepare(), /configure an approval workflow/);
  await assert.rejects(fixture([stage('Finance', [1]), stage('Treasury', [2])]).prepare(), /eligible active approvers/);
});

