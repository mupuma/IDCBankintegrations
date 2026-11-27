const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/portal.cjs');

function fixture() {
  const user = { id: 1, username: 'operator', password: 'hash', email: 'operator@example.test', isActive: true };
  let row, code;
  const service = load('idcbanksinegration/app/lib/loginOtp.ts', {
    './db': { getSequelize: async () => ({ transaction: run => run({ LOCK: { UPDATE: 'UPDATE' } }) }) },
    '../models/internal/LoginOtp': { LoginOtpChallenge: {
      findByPk: async () => row,
      upsert: async values => { row = { ...values, update: async next => Object.assign(row, next) }; },
    } },
    '../models/internal/User': { User: { findByPk: async () => user, findOne: async () => user } },
    './loginSmtp': { sendLoginEmail: async (_config, _email, _subject, body) => { code = body.match(/\d{6}/)[0]; } },
  });
  return { service, user, issue: () => service.issueLoginOtp(user, {}), code: () => code, row: () => row };
}

test('email codes are single-use and regeneration is rate limited', async () => {
  process.env.JWT_SECRET ||= 'test-only-login-secret';
  const f = fixture();
  const challenge = await f.issue();
  assert.ok(challenge);
  assert.equal(await f.issue(), null);
  assert.equal(await f.service.verifyLoginOtp(f.user.username, challenge, f.code()), f.user);
  assert.equal(await f.service.verifyLoginOtp(f.user.username, challenge, f.code()), null);
});

test('expired codes, five wrong attempts and changed addresses invalidate a challenge', async () => {
  process.env.JWT_SECRET ||= 'test-only-login-secret';
  const f = fixture();
  let challenge = await f.issue();
  const wrong = f.code() === '000000' ? '000001' : '000000';
  for (let attempt = 0; attempt < 5; attempt++) {
    assert.equal(await f.service.verifyLoginOtp(f.user.username, challenge, wrong), null);
  }
  assert.equal(await f.service.verifyLoginOtp(f.user.username, challenge, f.code()), null);
  f.row().issuedAt = new Date(0);
  challenge = await f.issue();
  f.row().issuedAt = new Date(0);
  assert.equal(await f.service.verifyLoginOtp(f.user.username, challenge, f.code()), null);
  challenge = await f.issue();
  f.user.email = 'changed@example.test';
  assert.equal(await f.service.verifyLoginOtp(f.user.username, challenge, f.code()), null);
});

