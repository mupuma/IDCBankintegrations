const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/portal.cjs');
const { transactionHealth: health } = load('idcbanksinegration/app/lib/transactionHealth.ts');

test('confirmed healthy transactions show OK while errors and unresolved outcomes stay visible', () => {
  for (const status of ['success', 'paid']) assert.deepEqual(health(status), { text: 'OK!', tone: 'healthy' });
  assert.equal(health('paid', 'Conflicting bank reference').tone, 'error');
  for (const status of ['failed', 'rejected', 'unknown', 'needs_review', 'partially_completed']) {
    assert.deepEqual(health(status), { text: 'Needs attention', tone: 'error' });
  }
  for (const status of ['queued', 'pulled', 'accepted', 'processing', 'submitting']) assert.equal(health(status).tone, 'pending');
});
