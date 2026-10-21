const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/portal.cjs');
const prefix = 'idcbanksinegration/app/';
const bankRead = load(prefix + 'lib/vendorBankRead.ts');
const json = { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } };
const auth = { requirePermission: async () => ({ id: 1, username: 'operator' }), isAuthError: () => false };

function swiftFixture({ optionalError } = {}) {
  const queries = [];
  const swift = load(prefix + 'lib/sageVendorBankDetails.ts', {
    './sageDb': { __esModule: true, default: { query: async (sql, options) => {
      queries.push({ sql, options });
      if (sql.includes('FROM APVENO')) {
        if (optionalError) throw optionalError;
        return [
        { vendorId: 'V1', optfield: 'TPIN', value: '0012345678' },
        { vendorId: 'V1', optfield: 'PURPOSE', value: 'P01' },
        { vendorId: 'V1', optfield: 'SECTOR', value: 'S01' },
      ]; }
      return [{ vendorId: 'V1', taxNumber: 'TAX-FALLBACK' }, { vendorId: 'V2', taxNumber: '0098765432' }];
    } } },
  });
  return { swift, queries };
}

test('vendor TPIN uses saved details, then Sage optional TPIN, then Sage tax number without losing leading zeroes', async () => {
  const { swift, queries } = swiftFixture();
  const fallback = await swift.loadVendorSwiftDetails(['V1', 'V2', 'V1']);
  assert.deepEqual(fallback.get('V1'), { tpin: '0012345678', purposeCode: 'P01', sectorCode: 'S01' });
  assert.equal(fallback.get('V2').tpin, '0098765432');
  const saved = { tpin: ' 0000000001 ', purposeCode: 'P99', sectorCode: 'S99' };
  assert.deepEqual(swift.mergeVendorSwiftDetails(saved, fallback.get('V1')), { tpin: '0000000001', purposeCode: 'P99', sectorCode: 'S99' });
  assert.equal(saved.tpin, ' 0000000001 ');
  assert.equal(swift.mergeVendorSwiftDetails({ tpin: ' ' }, fallback.get('V1')).tpin, '0012345678');
  assert.deepEqual(queries[0].options.replacements.vendorIds, ['V1', 'V2']);
  assert.equal(queries.length, 2);
  await swift.loadVendorSwiftDetails([]); assert.equal(queries.length, 2);
});

test('missing Sage optional-field storage does not hide saved vendor details or vendor tax numbers', async () => {
  const { swift } = swiftFixture({ optionalError: { original: { number: 208 } } });
  const details = await swift.loadVendorSwiftDetails(['V1', 'V2']);
  assert.equal(details.get('V2').tpin, '0098765432');
  assert.equal(swift.mergeVendorSwiftDetails({ tpin: '001234' }, details.get('V2')).tpin, '001234');
  const failure = Object.assign(new Error('permission denied'), { parent: { number: 229 } });
  const blocked = swiftFixture({ optionalError: failure });
  await assert.rejects(blocked.swift.loadVendorSwiftDetails(['V1']), error => error === failure);
});

test('old vendor address text remains readable and schema/login failures produce actionable errors without credentials', () => {
  const record = { tpin: '00123', physicalAddress: 'Plot 1, Main Street' };
  assert.deepEqual(bankRead.normalizeVendorBankRecord(record).physicalAddress, { streetName: record.physicalAddress, town: '', plotNo: '' });
  assert.equal(record.physicalAddress, 'Plot 1, Main Street');
  assert.deepEqual(bankRead.normalizeVendorBankRecord({ physicalAddress: '{"town":"Lusaka"}' }).physicalAddress, { town: 'Lusaka' });
  assert.match(bankRead.vendorBankReadError({ parent: { number: 207 } }), /source column/);
  assert.match(bankRead.vendorBankReadError({ original: { number: 208 } }), /SAGE_DB_NAME/);
  assert.match(bankRead.vendorBankReadError({ original: { number: 1088 } }), /SAGE_VENBANK_SCHEMA.*permissions/);
  assert.match(bankRead.vendorBankReadError({ original: { number: 51001 } }), /schema setup is disabled/);
  assert.match(bankRead.vendorBankReadError({ cause: { code: 'ELOGIN', message: 'password=private' } }), /login failed/);
  assert.equal(bankRead.vendorBankReadError(new Error('password=private')).includes('private'), false);
});

test('Sage optional field mapping supports a custom TPIN field', () => {
  const { swift } = swiftFixture();
  const before = process.env.SAGE_VENDOR_BANK_OPTIONAL_FIELDS;
  try {
    process.env.SAGE_VENDOR_BANK_OPTIONAL_FIELDS = JSON.stringify({ tpin: ['VENDTPIN'] });
    const details = swift.buildVendorBankDetails({ vendorId: 'V1', taxNumber: 'tax', optionalFields: new Map([['VENDTPIN', '000123']]) });
    assert.equal(details.tpin, '000123');
  } finally {
    if (before === undefined) delete process.env.SAGE_VENDOR_BANK_OPTIONAL_FIELDS;
    else process.env.SAGE_VENDOR_BANK_OPTIONAL_FIELDS = before;
  }
});

test('payments pulled from Sage carry saved and fallback SWIFT details without modifying vendor rows', async () => {
  const { swift } = swiftFixture();
  const bank = { vendorid: 'V1', accven: '001122', accname: 'Vendor', swiftcde: 'TESTZMLX', tpin: '0000000001', purposeCode: '', sectorCode: '' };
  let writes = 0;
  const route = load(prefix + 'api/v1/payments_by_date/route.ts', {
    'next/server': json, '@/app/lib/rbac': auth, '@/app/lib/permissions': { PERMISSIONS: {} },
    '@/app/lib/sageDb': { connectSageDatabase: async () => {} },
    '@/app/lib/vendorBankStore': { connectVendorBankDatabase: async () => {} },
    '@/app/lib/sageVendorBankDetails': swift,
    '@/app/models/sage_entities/Appym': { Appym: { findAll: async () => [{ idvend: 'V1', amtpaym: 100, codecurn: 'USD', datebus: 20261021, paymcode: 'TT' }] } },
    '@/app/models/sage_entities/Aptcr': { Aptcr: { findAll: async () => [] } },
    '@/app/models/sage_entities/Apven': { Apven: { findAll: async () => [] } },
    '@/app/models/internal/VendorBankDetail': { VendorBankDetail: { findAll: async () => [bank], create: async () => { writes++; } } },
  });
  const result = await route.POST({ json: async () => ({ startDate: 20261001, endDate: 20261021 }) });
  assert.equal(result.status, 200);
  assert.equal(result.body.data[0].tpin, '0000000001');
  assert.equal(result.body.data[0].purposeCode, 'P01');
  assert.equal(result.body.data[0].sectorCode, 'S01');
  assert.equal(result.body.data[0].swiftCode, 'TESTZMLX');
  assert.equal(result.body.data[0].transactionType, 'TT');
  assert.equal(writes, 0); assert.equal(bank.purposeCode, '');
});

test('vendor edit endpoint saves TPIN and SWIFT codes, rejects malformed values and preserves omitted fields', async () => {
  const validation = load(prefix + 'lib/vendorSwiftValidation.ts');
  const bank = { vendorid: 'V1', tpin: '00123', update: async values => Object.assign(bank, values), toJSON: () => ({ tpin: bank.tpin }) };
  const route = load(prefix + 'api/v1/bank_details/[id]/route.ts', {
    'next/server': json, '@/app/lib/rbac': auth, '@/app/lib/permissions': { PERMISSIONS: {} },
    '@/app/lib/auditLog': { logAuditEvent: async () => {} },
    '@/app/lib/sageDb': { connectSageDatabase: async () => {} },
    '@/app/lib/vendorBankStore': { connectVendorBankDatabase: async () => {} },
    '@/app/lib/vendorSwiftValidation': validation,
    '@/app/lib/vendorBankRead': bankRead,
    '@/app/models/internal/VendorBankDetail': { VendorBankDetail: { findByPk: async () => bank } },
  });
  const edit = body => route.PUT({ json: async () => body }, { params: Promise.resolve({ id: 'portal-1' }) });
  assert.equal((await route.PUT({ json: async () => ({ tpin: '001' }) }, { params: Promise.resolve({ id: '1' }) })).status, 409);
  assert.equal((await edit({ tpin: 123 })).status, 400);
  assert.equal((await edit({ purposeCode: '123456789' })).status, 400);
  assert.equal(bank.tpin, '00123');
  assert.equal((await edit({ tpin: ' 000987 ', purposeCode: ' P01 ', sectorCode: ' S01 ' })).status, 200);
  assert.equal(bank.tpin, '000987'); assert.equal(bank.purposeCode, 'P01');
  await edit({ accname: 'Updated name' }); assert.equal(bank.tpin, '000987');
});

test('vendor creation stores SWIFT details and the list pre-fills Sage values for editing', async () => {
  const { swift } = swiftFixture();
  const validation = load(prefix + 'lib/vendorSwiftValidation.ts');
  let created;
  const existing = { vendorid: 'V1', toJSON: () => ({ vendorid: 'V1', tpin: '', physicalAddress: null }) };
  const route = load(prefix + 'api/v1/bank_details/route.ts', {
    'next/server': json, '../../../lib/rbac': auth, '../../../lib/permissions': { PERMISSIONS: {} },
    '../../../lib/auditLog': { logAuditEvent: async () => {} },
    '../../../lib/vendorBankStore': { connectVendorBankDatabase: async () => {} },
    '../../../lib/sageVendorBankDetails': swift,
    '../../../lib/vendorSwiftValidation': validation,
    '../../../lib/vendorBankRead': bankRead,
    '../../../models/internal/VendorBankDetail': { VendorBankDetail: {
      findAll: async () => [existing], count: async () => 1, findOne: async () => null,
      create: async data => { created = data; return { id: 1, toJSON: () => data }; },
    } },
  });
  assert.equal((await route.POST({ json: async () => ({ vendorid: 'V1', accname: 'Vendor', tpin: '001122', purposeCode: 'P01', sectorCode: 'S01' }) })).status, 201);
  assert.equal(created.tpin, '001122'); assert.equal(created.sectorCode, 'S01');
  const result = await route.GET({ nextUrl: new URL('http://portal/api/v1/bank_details') });
  assert.equal(result.status, 200); assert.equal(result.body.data[0].tpin, '0012345678');
  assert.equal(result.body.data[0].purposeCode, 'P01');
});

test('vendor list reports database failures as a structured unavailable response, not an empty successful list', async () => {
  const { swift } = swiftFixture();
  const route = load(prefix + 'api/v1/bank_details/route.ts', {
    'next/server': json, '../../../lib/rbac': auth, '../../../lib/permissions': { PERMISSIONS: {} },
    '../../../lib/auditLog': { logAuditEvent: async () => {} },
    '../../../lib/vendorBankStore': { connectVendorBankDatabase: async () => { throw { original: { number: 207 } }; } },
    '../../../lib/sageVendorBankDetails': swift,
    '../../../lib/vendorSwiftValidation': load(prefix + 'lib/vendorSwiftValidation.ts'),
    '../../../lib/vendorBankRead': bankRead,
    '../../../models/internal/VendorBankDetail': { VendorBankDetail: {} },
  });
  const result = await route.GET({ nextUrl: new URL('http://portal/api/v1/bank_details') });
  assert.equal(result.status, 503); assert.equal(result.body.success, false);
  assert.match(result.body.error, /source column/); assert.equal(result.body.data, undefined);
});

test('internal schema additions preserve existing columns and data and never use destructive sync', async () => {
  const { syncSchemaAddOnly } = load(prefix + 'lib/schemaSync.ts');
  const calls = [];
  const rows = [{ id: 1, legacy: 'keep me' }];
  const model = { tableName: 'existing', getAttributes: () => ({ id: { type: 'INT', field: 'ID' }, tpin: { type: 'VARCHAR(20)', allowNull: true } }) };
  const missing = { tableName: 'new_table', sync: async options => calls.push(['create', options]) };
  await syncSchemaAddOnly({ getQueryInterface: () => ({
    showAllTables: async () => ['existing'],
    describeTable: async () => ({ id: { type: 'INT' }, legacy: { type: 'TEXT' } }),
    addColumn: async (...args) => calls.push(['add', ...args]),
    dropTable: () => assert.fail('must not drop tables'),
    removeColumn: () => assert.fail('must not remove columns'),
    changeColumn: () => assert.fail('must not change existing column types'),
  }) }, [model, missing]);
  assert.deepEqual(rows, [{ id: 1, legacy: 'keep me' }]);
  assert.equal(calls.length, 2); assert.deepEqual(calls[0].slice(0, 3), ['add', 'existing', 'tpin']);
  assert.deepEqual(calls[1], ['create', { force: false, alter: false }]);
});
