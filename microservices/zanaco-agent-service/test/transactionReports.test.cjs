const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/portal.cjs');
const references = load('idcbanksinegration/app/lib/bankResponseDetails.ts');
const reports = load('idcbanksinegration/app/lib/transactionReports.ts', { './bankResponseDetails': references });
const permissions = load('idcbanksinegration/app/lib/permissions.ts');
const filters = values => reports.parseReportFilters(new URLSearchParams(values));
const record = (id = 1, overrides = {}) => ({ id, queueId: `QUEUE-${id}`, paymentId: `IDC-${id}`, bankCode: 'IZB', sourceBank: '77050',
  status: 'success', attempts: 1, createdAt: '2026-11-12T12:00:00Z', updatedAt: '2026-11-13T22:00:00Z',
  paymentPayload: JSON.stringify({ paymentId: `IDC-${id}`, vendorId: 'V-001', accountName: 'Supplier', accountNumber: '001234', amount: '123.45', currency: 'ZMW', transactionType: 'RTGS', transactionDate: '2026-11-12' }),
  responsePayload: JSON.stringify({ processedAt: '2026-11-13T21:59:59Z', bankNotification: { bankResponse: { bankReference: 'IZB-BANK-123' } } }), ...overrides });

test('only administrators and operators can view reconciliation reports', () => {
  const { roleHasPermission: has, ROLES, PERMISSIONS: P } = permissions;
  for (const role of [ROLES.ADMIN, ROLES.OPERATOR]) assert.equal(has(role, P.REPORTS_READ), true);
  for (const role of [ROLES.BANK_DETAILS_MAKER, ROLES.VIEWER, 'UNKNOWN']) assert.equal(has(role, P.REPORTS_READ), false);
});

test('report dates use UTC+2, inclusive dates, explicit date bases and labelled historical fallbacks', () => {
  assert.equal(reports.localReportDate('2026-12-31T22:00:00Z'), '2027-01-01');
  const f = filters({ from: '2026-11-13', to: '2026-11-13' }), row = reports.reportRows(record(), f)[0];
  assert.equal(row.reportDate, '2026-11-13'); assert.equal(reports.matchesReport(row, f), true);
  assert.equal(reports.matchesReport(row, filters({ from: '2026-11-14' })), false);
  const historical = reports.reportRows(record(1, { responsePayload: '{}' }), filters({}))[0];
  assert.equal(historical.reportDate, '2026-11-14'); assert.match(historical.dateSource, /historical fallback/);
  const paymentDate = reports.reportRows(record(), filters({ dateBasis: 'payment' }))[0];
  assert.equal(paymentDate.reportDate, '2026-11-12');
  assert.throws(() => filters({ from: '2026-02-30' }));
  assert.throws(() => filters({ from: '2026-12-01', to: '2026-11-01' }));
  assert.throws(() => filters({ minAmount: '200', maxAmount: '100' }));
});

test('detailed filters cover accounts, vendors, amounts, nested bank references, currency and status', () => {
  const row = reports.reportRows(record(), filters({}))[0];
  assert.equal(reports.matchesReport(row, filters({ vendor: 'supplier', account: '001234', reference: 'izb-bank', minAmount: '123', maxAmount: '124', bank: 'IZB', sourceBank: '77050', currency: 'zmw', transactionType: 'rtgs', missingReference: 'no' })), true);
  assert.equal(reports.matchesReport(row, filters({ missingReference: 'yes' })), false);
  assert.equal(reports.matchesReport(row, filters({ minAmount: '124' })), false);
  const pending = { ...row, status: 'accepted' }, failed = { ...row, status: 'failed' };
  assert.equal(reports.matchesReport(pending, filters({})), false);
  assert.equal(reports.matchesReport(failed, filters({ status: 'final' })), true);
  assert.equal(reports.matchesReport(pending, filters({ status: 'all' })), true);
});

test('bulk payments retain every item, identity and batch-level status without double counting the batch amount', () => {
  const bulk = record(2, { status: 'partially_completed', paymentPayload: JSON.stringify({ service: 'ZANACO_BULK_DDAC',
    request: { totalAmount: 30, currency: 'ZMW', items: [{ externalTranRef: 'EXT-1', name: 'First', amount: 10 }, { externalTranRef: 'EXT-2', name: 'Second', amount: 20 }] },
    meta: { transactionType: 'DDACCT', paymentIds: ['P1', 'P2'], payments: [{ paymentId: 'P1', vendorId: 'V1' }, { paymentId: 'P2', vendorId: 'V2' }] } }) });
  const rows = reports.reportRows(bulk, filters({ status: 'all' }));
  assert.equal(rows.length, 2); assert.deepEqual(rows.map(row => row.paymentId), ['P1', 'P2']);
  assert.deepEqual(rows.map(row => row.vendorId), ['V1', 'V2']);
  assert.ok(rows.every(row => row.statusScope === 'Batch' && row.status === 'partially_completed'));
  const summary = reports.createReportSummary('month'); rows.forEach(row => summary.add(row));
  assert.equal(summary.rows()[0].amount, '30.000000'); assert.equal(summary.rows()[0].count, 2);
});

test('totals keep currencies and statuses separate and sum decimals exactly without losing large monetary values', () => {
  const base = reports.reportRows(record(), filters({}))[0], summary = reports.createReportSummary('year');
  for (const amount of ['9007199254740993.123456', '0.100000', '0.200000']) summary.add({ ...base, amount });
  summary.add({ ...base, currency: 'USD', amount: '5' });
  summary.add({ ...base, status: 'failed', amount: '' });
  assert.equal(summary.rows().length, 3);
  assert.equal(summary.rows().find(row => row.currency === 'ZMW' && row.status === 'success').amount, '9007199254740993.423456');
  assert.equal(summary.rows().find(row => row.status === 'failed').missingAmounts, 1);
  assert.ok(summary.rows().every(row => row.period === '2026'));
});

test('malformed legacy payloads and missing amounts remain visible with quality notes and original content', () => {
  const row = reports.reportRows(record(3, { paymentPayload: 'broken JSON', responsePayload: 'broken response' }), filters({ status: 'all' }))[0];
  assert.equal(reports.matchesReport(row, filters({ status: 'all' })), true);
  assert.equal(row.payment.unparsedPayload, 'broken JSON'); assert.match(row.dataQuality, /Amount missing/);
  assert.match(reports.reportCsvRow(row), /broken response/);
  assert.equal(reports.csvCell('=HYPERLINK("bad")').startsWith('"\''), true);
  assert.equal(reports.csvCell('one,two\n"three"'), '"one,two\n""three"""');
});

function storeFixture(count = 1203) {
  const Op = { gt: Symbol('gt'), lte: Symbol('lte') }, calls = [];
  const records = Array.from({ length: count }, (_, i) => record(i + 1));
  const store = load('idcbanksinegration/app/lib/transactionReportStore.ts', {
    sequelize: { Op }, './db': { connectDatabase: async () => {} }, './transactionReports': reports,
    '@/app/models/internal/PaymentQueueRequest': { PaymentQueueRequest: {
      findOne: async () => records.at(-1),
      findAll: async options => { calls.push(options); return records.filter(row => row.id > Number(options.where.id[Op.gt]) && row.id <= Number(options.where.id[Op.lte])).slice(0, options.limit); },
    } },
  });
  return { store, calls };
}

test('report scanning reaches every saved row beyond dashboard limits in bounded batches', async () => {
  const f = storeFixture(); let count = 0;
  for await (const row of f.store.matchingReportRows(filters({}))) { count++; assert.ok(row.paymentId); }
  assert.equal(count, 1203); assert.equal(f.calls.length, 4); assert.ok(f.calls.every(call => call.limit === 500));
});

function routeFixture(denied = false) {
  const f = storeFixture();
  const route = load('idcbanksinegration/app/api/v1/transaction_reports/route.ts', {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200, headers: options.headers }) } },
    '@/app/lib/rbac': { requirePermission: async (_request, permission) => { assert.equal(permission, 'reports:read'); return denied ? { denied: true, status: 403 } : { username: 'operator' }; }, isAuthError: value => value.denied },
    '@/app/lib/permissions': permissions, '@/app/lib/transactionReportStore': f.store, '@/app/lib/transactionReports': reports,
  });
  return { ...f, get: query => route.GET({ nextUrl: { searchParams: new URLSearchParams(query) } }) };
}

test('report API enforces access and validates filters before scanning any financial data', async () => {
  const denied = routeFixture(true); assert.equal((await denied.get('')).status, 403); assert.equal(denied.calls.length, 0);
  const allowed = routeFixture(); assert.equal((await allowed.get('status=bogus')).status, 400); assert.equal(allowed.calls.length, 0);
});

test('JSON totals cover all matching pages and CSV exports every matching transaction with full details', async () => {
  const f = routeFixture(), page = await f.get('page=2&pageSize=25');
  assert.equal(page.body.total, 1203); assert.equal(page.body.items.length, 25); assert.equal(page.body.items[0].paymentId, 'IDC-26');
  assert.equal(page.body.groups[0].count, 1203); assert.equal(page.headers['Cache-Control'], 'private, no-store');
  const response = await f.get('format=csv&page=2'), csv = await response.text();
  assert.equal(csv.trimEnd().split('\r\n').length, 1204);
  assert.match(csv, /IDC-1203/); assert.match(csv, /IZB-BANK-123/); assert.match(csv, /bankNotification/);
  const summary = await f.get('format=summary_csv&groupBy=month');
  assert.match(await summary.text(), /148510.350000/);
});
