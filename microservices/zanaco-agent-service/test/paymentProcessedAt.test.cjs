const test = require('node:test');
const assert = require('node:assert/strict');
const { load, applySqlUpdate } = require('./helpers/portal.cjs');
const processed = load('idcbanksinegration/app/lib/paymentProcessedAt.ts');
const { Sequelize } = require('../../../idcbanksinegration/node_modules/sequelize');

test('final status writes use database COALESCE so later writes cannot replace the receipt timestamp', () => {
  const first = new Date('2026-11-13T20:21:22.123Z'), later = new Date('2026-11-14T10:11:12.456Z');
  const row = { status: 'accepted', processedAt: null };
  applySqlUpdate(row, { ...processed.processedAtWrite('failed', first), status: 'failed' });
  assert.equal(row.processedAt.toISOString(), first.toISOString());
  applySqlUpdate(row, { ...processed.processedAtWrite('success', later), status: 'success' });
  assert.equal(row.processedAt.toISOString(), first.toISOString());
  const successor = { processedAt: null };
  applySqlUpdate(successor, processed.processedAtWrite('success', later));
  assert.equal(successor.processedAt.toISOString(), later.toISOString(), 'a corrected new attempt has its own receipt time');
});

test('the real MySQL query generator writes the immutable timestamp in the same statement as the final status', () => {
  const db = new Sequelize('portal', 'test', 'test', { dialect: 'mysql', logging: false });
  const query = db.getQueryInterface().queryGenerator.updateQuery('payment_queue_requests', {
    processed_at: processed.processedAtWrite('paid', new Date('2026-11-13T20:21:22.123Z')).processedAt, status: 'paid',
  }, { queueId: 'QUEUE1' }, {});
  assert.match(query.query, /`processed_at`=COALESCE\(`processed_at`, '2026-11-13 20:21:22\.123'\)/);
  assert.match(query.query, /`status`=/);
});

test('pending, uncertain, review and never-sent outcomes do not get a bank processed timestamp', () => {
  for (const status of ['queued', 'processing', 'submitting', 'pulled', 'accepted', 'unknown', 'needs_review']) {
    assert.deepEqual(processed.processedAtWrite(status), {});
  }
  assert.deepEqual(processed.processedAtWrite('rejected', new Date(), { notSent: true }), {});
  assert.deepEqual(processed.processedAtWrite('failed', new Date(), { recovery: { notSent: true } }), {});
});

test('historical backfill is restricted to saved server receipt times and never last-modified timestamps', () => {
  assert.match(processed.BACKFILL_PAYMENT_PROCESSED_AT_SQL, /WHERE processed_at IS NULL/);
  assert.doesNotMatch(processed.BACKFILL_PAYMENT_PROCESSED_AT_SQL, /updated_at|created_at|datebus/i);
  assert.match(processed.BACKFILL_PAYMENT_PROCESSED_AT_SQL, /JSON_VALID/);
  assert.match(processed.BACKFILL_PAYMENT_PROCESSED_AT_SQL, /historical/);
  assert.equal(processed.processedAtIso(null), null);
  assert.equal(processed.processedAtIso('invalid'), null);
  assert.equal(processed.processedAtIso('2026-11-13T20:21:22.123Z'), '2026-11-13T20:21:22.123Z');
  assert.equal(processed.processedAtIso(new Date('2026-11-13T20:21:22.123Z')), '2026-11-13T20:21:22.123Z');
});
