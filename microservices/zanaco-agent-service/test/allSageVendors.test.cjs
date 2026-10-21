const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/portal.cjs');
const root = 'idcbanksinegration/app/';
const readPolicy = load(root + 'lib/sageQueryPolicy.ts');
const details = load(root + 'lib/sageVendorBankDetails.ts', { './sageDb': { __esModule: true, default: {} } });
const json = { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } };
const auth = { requirePermission: async () => ({ id: 1, username: 'operator' }), isAuthError: () => false };
const vendor = n => ({ vendorid: `V${String(n).padStart(5, '0')}`, vendname: `Vendor ${n}`, active: n % 2,
  phoneNumber: '+260211000000/260977000000', taxNumber: '0012345678', addressLine1: 'Main Street', city: 'Lusaka', country: 'Zambia' });

test('Sage vendor source reads the entire APVEN master without a payment-history join or row cap', async () => {
  const all = Array.from({ length: 1203 }, (_, n) => vendor(n));
  let request;
  const source = load(root + 'lib/sageVendors.ts', { './sageDb': { __esModule: true,
    connectSageDatabase: async () => {}, default: { query: async (sql, options) => {
      readPolicy.assertSageQueryAllowed(sql, false); request = { sql, options }; return all;
    } },
  } });
  const rows = await source.loadSageVendors();
  assert.equal(rows.length, 1203); assert.equal(rows.at(-1).vendorid, 'V01202');
  assert.match(request.sql, /FROM APVEN v/);
  assert.doesNotMatch(request.sql, /\b(?:APPYM|JOIN|TOP|OFFSET|FETCH)\b/i);
  assert.equal(request.options.replacements.search, null);
  await source.loadSageVendors("Vendor's");
  assert.equal(request.options.replacements.search, "%Vendor's%");
  assert.equal(request.sql.includes("Vendor's"), false);
});

test('master sync imports over 1,200 vendors in bounded batches and preserves portal edits and deletions', async () => {
  const all = Array.from({ length: 1203 }, (_, n) => vendor(n));
  const saved = new Map([[all[0].vendorid, { vendorid: all[0].vendorid, accname: 'Portal correction', tpin: '00001' }],
    [all[1].vendorid, { vendorid: all[1].vendorid, deletedAt: new Date() }]]);
  const batchSizes = [], optionalSizes = [];
  const sync = load(root + 'lib/sageVendorSync.ts', {
    './sageVendors': { loadSageVendors: async () => all },
    './sageVendorBankDetails': { ...details, loadVendorOptionalFields: async ids => {
      optionalSizes.push(ids.length); return new Map(ids.map(id => [id, new Map([['BNKACCT', '001122'], ['BNKNAME', 'Full bank name']])]));
    } },
    '../models/internal/VendorBankDetail': { VendorBankDetail: {
      findAll: async options => { assert.equal(options.paranoid, false); return [...saved.values()]; },
      bulkCreate: async (seeds, options) => {
        assert.equal(options.ignoreDuplicates, undefined); batchSizes.push(seeds.length);
        for (const seed of seeds) { assert.equal(saved.has(seed.vendorid), false); saved.set(seed.vendorid, seed); }
      },
    } },
  });
  assert.deepEqual(await sync.syncSageVendorMaster(), { sageVendorCount: 1203, addedCount: 1201 });
  assert.equal(saved.size, 1203); assert.equal(batchSizes.length, 7);
  assert.equal(batchSizes.every(size => size <= 200), true); assert.deepEqual(optionalSizes, batchSizes);
  assert.equal(saved.get('V00000').accname, 'Portal correction'); assert.equal(saved.get('V00000').tpin, '00001');
  assert.ok(saved.get('V00001').deletedAt);
  assert.equal(saved.get('V01202').accven, '001122'); assert.equal(saved.get('V01202').tpin, '0012345678');
  assert.equal(saved.get('V01202').phoneNumber, all.at(-1).phoneNumber);
});

test('concurrent master sync preserves a concurrently saved row rather than overwriting it', async () => {
  const row = vendor(1), saved = { ...row, accname: 'Concurrent portal edit' };
  const sync = load(root + 'lib/sageVendorSync.ts', {
    './sageVendors': { loadSageVendors: async () => [row] },
    './sageVendorBankDetails': { ...details, loadVendorOptionalFields: async () => new Map() },
    '../models/internal/VendorBankDetail': { VendorBankDetail: {
      findAll: async () => [],
      bulkCreate: async () => { throw { name: 'SequelizeUniqueConstraintError' }; },
      findOrCreate: async options => { assert.equal(options.paranoid, false); return [saved, false]; },
    } },
  });
  assert.deepEqual(await sync.syncSageVendorMaster(), { sageVendorCount: 1, addedCount: 0 });
  assert.equal(saved.accname, 'Concurrent portal edit');
});

test('storage failures remain errors and never fall back to an INSERT IGNORE that could truncate source data', async () => {
  const sync = load(root + 'lib/sageVendorSync.ts', {
    './sageVendors': { loadSageVendors: async () => [vendor(1)] },
    './sageVendorBankDetails': { ...details, loadVendorOptionalFields: async () => new Map() },
    '../models/internal/VendorBankDetail': { VendorBankDetail: {
      findAll: async () => [], bulkCreate: async () => { throw { name: 'SequelizeDatabaseError', code: 'ER_DATA_TOO_LONG' }; },
      findOrCreate: () => assert.fail('must not suppress a storage error'),
    } },
  });
  await assert.rejects(sync.syncSageVendorMaster(), error => error.importStage === 'portal_save' && error.cause.code === 'ER_DATA_TOO_LONG');
});

test('vendor API includes complete, inactive and no-payment vendors', async () => {
  const rows = [vendor(1), vendor(2), vendor(3)];
  const route = load(root + 'api/v1/vendors/route.ts', {
    'next/server': json, '../../../lib/rbac': auth, '../../../lib/permissions': { PERMISSIONS: {} },
    '../../../lib/sageVendors': { loadSageVendors: async () => rows },
    '../../../lib/sageVendorBankDetails': { ...details, loadVendorOptionalFields: async () => new Map() },
    '../../../lib/vendorBankStore': { connectVendorBankDatabase: async () => ({ sageVendorCount: 3 }) },
    '../../../models/internal/VendorBankDetail': { VendorBankDetail: { findAll: async () => [
      { id: 1, vendorid: rows[0].vendorid, accven: '001122', accname: 'Saved complete vendor', physicalAddress: { town: 'Lusaka' } },
    ] } },
  });
  const response = await route.GET({ nextUrl: new URL('http://portal/api/v1/vendors') });
  assert.equal(response.status, 200); assert.equal(response.body.total, 3);
  assert.equal(response.body.vendors[0].bankDetailsStatus, 'complete');
  assert.equal(response.body.vendors[1].active, false);
  assert.equal(response.body.vendors[2].bankDetailsId, null);
  assert.deepEqual(JSON.parse(response.body.vendors[0].physicalAddress), { town: 'Lusaka' });
});

test('large optional-field lookups read every vendor in batches without a 200-row limit', async () => {
  const ids = Array.from({ length: 1203 }, (_, n) => vendor(n).vendorid), sizes = [];
  const helper = load(root + 'lib/sageVendorBankDetails.ts', { './sageDb': { __esModule: true, default: { query: async (sql, options) => {
    readPolicy.assertSageQueryAllowed(sql, false); sizes.push(options.replacements.vendorIds.length);
    return options.replacements.vendorIds.map(vendorId => ({ vendorId, optfield: 'TPIN', value: '001234' }));
  } } } });
  const values = await helper.loadVendorOptionalFields(ids);
  assert.deepEqual(sizes, [500, 500, 203]); assert.equal(values.size, 1203);
  assert.equal(values.get(ids.at(-1)).get('TPIN'), '001234');
});

test('bank details pagination can reach the final vendor beyond the old 200-record subset', async () => {
  const rows = Array.from({ length: 1203 }, (_, n) => ({ id: n + 1, vendorid: vendor(n).vendorid, accname: `Vendor ${n}` }));
  const route = load(root + 'api/v1/bank_details/route.ts', {
    'next/server': json, '../../../lib/rbac': auth, '../../../lib/permissions': { PERMISSIONS: {} },
    '../../../lib/auditLog': { logAuditEvent: async () => {} },
    '../../../lib/vendorBankStore': { connectVendorBankDatabase: async () => ({ sageVendorCount: rows.length }) },
    '../../../lib/sageVendorBankDetails': { ...details, loadVendorSwiftDetails: async () => new Map() },
    '../../../lib/vendorSwiftValidation': load(root + 'lib/vendorSwiftValidation.ts'),
    '../../../lib/vendorBankRead': load(root + 'lib/vendorBankRead.ts'),
    '../../../models/internal/VendorBankDetail': { VendorBankDetail: {
      count: async () => rows.length,
      findAll: async options => rows.slice(options.offset, options.offset + options.limit).map(row => ({ ...row, toJSON: () => row })),
    } },
  });
  const response = await route.GET({ nextUrl: new URL('http://portal/api/v1/bank_details?page=12&limit=100') });
  assert.equal(response.status, 200); assert.equal(response.body.data.length, 3);
  assert.equal(response.body.data.at(-1).vendorid, 'V01202');
  assert.equal(response.body.sageVendorCount, 1203);
  assert.equal(response.body.pagination.totalItems, 1203); assert.equal(response.body.pagination.totalPages, 13);
  assert.equal(response.body.pagination.hasNext, false);
});

test('forced refresh reloads Sage after cached startup and shared requests do not duplicate synchronization', async () => {
  let calls = 0;
  const store = load(root + 'lib/vendorBankStore.ts', {
    './db': { connectDatabase: async () => {} },
    './sageVendorSync': { syncSageVendorMaster: async () => ({ sageVendorCount: 1000 + ++calls, addedCount: 1 }) },
    './sageDb': { __esModule: true, connectSageDatabase: async () => {}, default: { query: async () => [] } },
    '../models/internal/VendorBankDetail': { VendorBankDetail: {} },
    './vendorBankRead': load(root + 'lib/vendorBankRead.ts'),
  });
  const [first, concurrent] = await Promise.all([store.connectVendorBankDatabase(), store.connectVendorBankDatabase(true)]);
  assert.equal(calls, 1); assert.equal(first.sageVendorCount, 1001); assert.equal(concurrent.sageVendorCount, 1001);
  assert.equal((await store.connectVendorBankDatabase()).sageVendorCount, 1001);
  assert.equal(calls, 1);
  assert.equal((await store.connectVendorBankDatabase(true)).sageVendorCount, 1002); assert.equal(calls, 2);
});
