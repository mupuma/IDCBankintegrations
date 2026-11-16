const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/portal.cjs');
const { sourceProfile } = load('idcbanksinegration/app/lib/zicb/config.ts');

test('malformed source profile JSON gives actionable portal guidance without leaking configuration', t => {
  const original = process.env.ZICB_H2H_SOURCE_PROFILES;
  t.after(() => {
    if (original === undefined) delete process.env.ZICB_H2H_SOURCE_PROFILES;
    else process.env.ZICB_H2H_SOURCE_PROFILES = original;
  });
  process.env.ZICB_H2H_SOURCE_PROFILES = '{"PRIVATE_CONFIG_VALUE" "missing-colon"}';
  assert.throws(() => sourceProfile('77050'), error => {
    assert.match(error.message, /Invalid JSON in portal ZICB_H2H_SOURCE_PROFILES/);
    assert.match(error.message, /colon/);
    assert.match(error.message, /restart the portal/);
    assert.doesNotMatch(error.message, /PRIVATE_CONFIG_VALUE|missing-colon/);
    return true;
  });
  for (const invalid of ['null', '[]', '"text"', '123']) {
    process.env.ZICB_H2H_SOURCE_PROFILES = invalid;
    assert.throws(() => sourceProfile('77050'), /must be a JSON object keyed by source account code/);
  }
  delete process.env.ZICB_H2H_SOURCE_PROFILES;
  assert.throws(() => sourceProfile('77050'), /not configured for source account 77050/);
  const profile = { profileId: 'institution-uat', regionCode: 'CONFIRMED', currency: 'ZMW', amountScale: 2, channels: ['RTGS'] };
  process.env.ZICB_H2H_SOURCE_PROFILES = JSON.stringify({ '77050': profile });
  assert.deepEqual(sourceProfile('77050'), profile);
});
