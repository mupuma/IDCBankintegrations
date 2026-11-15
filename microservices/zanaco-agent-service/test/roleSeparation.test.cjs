const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/portal.cjs');
const permissions = load('idcbanksinegration/app/lib/permissions.ts');
const { PERMISSIONS: P, ROLES, roleHasPermission } = permissions;

test('bank detail makers and payment operators have separate duties, including administrators', () => {
  for (const role of Object.values(ROLES)) {
    assert.equal(roleHasPermission(role, P.BANK_DETAILS_WRITE) && roleHasPermission(role, P.PAYMENTS_POST), false, role);
  }
  assert.equal(roleHasPermission(ROLES.BANK_DETAILS_MAKER, P.BANK_DETAILS_WRITE), true);
  assert.equal(roleHasPermission(ROLES.BANK_DETAILS_MAKER, P.PAYMENTS_POST), false);
  assert.equal(roleHasPermission(ROLES.BANK_DETAILS_MAKER, P.PAYMENTS_RETRY), false);
  assert.equal(roleHasPermission(ROLES.OPERATOR, P.PAYMENTS_POST), true);
  assert.equal(roleHasPermission(ROLES.OPERATOR, P.PAYMENTS_RETRY), true);
  assert.equal(roleHasPermission(ROLES.OPERATOR, P.BANK_DETAILS_WRITE), false);
  assert.equal(roleHasPermission(ROLES.ADMIN, P.USERS_MANAGE), true);
  for (const role of [null, undefined, '', 'UNKNOWN']) {
    assert.equal(roleHasPermission(role, P.PAYMENTS_POST), false);
    assert.equal(roleHasPermission(role, P.BANK_DETAILS_WRITE), false);
  }
});

function fixture(role, fail = false) {
  class NextResponse {
    static json(body, options) { return Object.assign(new NextResponse(), { body, status: options?.status || 200 }); }
  }
  const rbac = load('idcbanksinegration/app/lib/rbac.ts', {
    'next/server': { NextResponse },
    '../api/auth/login/middleware/auth': { verifySessionToken: async () => ({ sub: '1', username: 'test', role: 'ADMIN' }) },
    './db': { connectDatabase: async () => { if (fail) throw new Error('Database unavailable'); } },
    './auditLog': { logAuditEvent: async () => {} },
    '../models/internal/User': { User: { findByPk: async () => ({ id: 1, username: 'test', role, isActive: true }) } },
    './permissions': permissions,
  });
  const request = { cookies: { get: () => ({ value: 'session' }) }, json: async () => ({}) };
  return { rbac, request, NextResponse };
}

test('server authorization uses the current database role rather than older token permissions', async () => {
  const maker = fixture(ROLES.BANK_DETAILS_MAKER);
  assert.equal((await maker.rbac.requirePermission(maker.request, P.PAYMENTS_POST)).status, 403);
  const operator = fixture(ROLES.OPERATOR);
  assert.equal((await operator.rbac.requirePermission(operator.request, P.BANK_DETAILS_WRITE)).status, 403);
  assert.equal((await operator.rbac.requirePermission(operator.request, P.PAYMENTS_POST)).role, ROLES.OPERATOR);
});

test('unavailable role lookup cannot restore privileges from stale token claims', async () => {
  const f = fixture(ROLES.BANK_DETAILS_MAKER, true);
  assert.equal((await f.rbac.requirePermission(f.request, P.PAYMENTS_POST)).status, 401);
});

test('legacy Sage queue endpoint also rejects makers before reading or enqueuing a payment', async () => {
  const f = fixture(ROLES.BANK_DETAILS_MAKER);
  const route = load('idcbanksinegration/app/api/v1/sage_posted_payments/route.ts', {
    'next/server': { NextResponse: f.NextResponse },
    '../../../lib/rbac': f.rbac, '../../../lib/permissions': permissions,
    '../../../lib/banks': { BANK_CODES: ['IZB', 'ZICB', 'ZANACO'] },
    '../../../lib/bankQueue': { enqueuePayment: () => assert.fail('A maker cannot enqueue') },
    '../../../lib/db': {}, '../../../models/internal/PaymentQueueRequest': {},
    '../../../lib/paymentPostGuard': {},
  });
  const response = await route.POST({ ...f.request, json: () => assert.fail('Must authorize before reading payment') });
  assert.equal(response.status, 403);
});
