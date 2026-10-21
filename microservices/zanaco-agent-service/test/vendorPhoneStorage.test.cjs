const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/portal.cjs');
const prefix = 'idcbanksinegration/app/lib/';
const { widenPortalVendorStorage } = load(prefix + 'portalVendorSchema.ts');
const bankRead = load(prefix + 'vendorBankRead.ts');
const { assertSageQueryAllowed } = load(prefix + 'sageQueryPolicy.ts');

test('widening portal MySQL restores long bank names and contacts without truncation or changing saved edits', async () => {
  const widths = { BANKID: 20, PHONE_NUMBER: 20 };
  const changes = [], sageQueries = [];
  const contact = '+260211000000/260977000000';
  const bankName = 'Bank name longer than the old bank-code limit ' + 'x'.repeat(300);
  const records = new Map([['V1', { vendorid: 'V1', phoneNumber: 'portal-edited-contact' }]]);
  const db = {
    getDialect: () => 'mysql', getQueryInterface: () => ({
      describeTable: async () => Object.fromEntries(Object.entries(widths).map(([column, width]) => [column, { type: width === Infinity ? 'LONGTEXT' : `VARCHAR(${width})`, allowNull: true, defaultValue: null }])),
      changeColumn: async (table, column, definition) => { changes.push({ table, column }); assert.equal(definition.type.toString(), 'LONGTEXT'); widths[column] = Infinity; },
    }),
  };
  const store = load(prefix + 'vendorBankStore.ts', {
    './db': { connectDatabase: async () => {} },
    './sageVendorSync': { syncSageVendorMaster: async () => ({ sageVendorCount: 0, addedCount: 0 }) },
    './sageDb': { __esModule: true, connectSageDatabase: async () => {}, default: { query: async sql => {
      assertSageQueryAllowed(sql, false); sageQueries.push(sql);
      if (sql.includes('sys.columns')) return ['VENDORID', 'ACCNAME', 'BANKID', 'PHONE_NUMBER'].map(name => ({ name }));
      return [{ vendorid: 'V1', accname: 'Source vendor', phoneNumber: 'old contact' },
        { vendorid: 'V2', accname: 'Multi-number vendor', bankid: bankName, phoneNumber: contact },
        { vendorid: 'V3', accname: 'Following vendor', phoneNumber: '0012345678' }];
    } } },
    '../models/internal/VendorBankDetail': { VendorBankDetail: { findOrCreate: async ({ where, defaults }) => {
      if (records.has(where.vendorid)) return [records.get(where.vendorid), false];
      for (const [column, property] of [['BANKID', 'bankid'], ['PHONE_NUMBER', 'phoneNumber']]) {
        if ((defaults[property] || '').length > widths[column]) throw Object.assign(new Error('Storage too short'), {
          original: { code: 'ER_DATA_TOO_LONG', errno: 1406, sqlMessage: `Data too long for column '${column}' at row 1` },
        });
      }
      records.set(where.vendorid, defaults); return [defaults, true];
    } } },
    './vendorBankRead': bankRead,
  });
  await assert.rejects(store.importLegacyVendorBanks(), error => {
    assert.equal(error.importStage, 'portal_save');
    assert.deepEqual(bankRead.vendorBankFailureDetails(error), { code: 'ER_DATA_TOO_LONG', number: 1406, column: 'BANKID' });
    return true;
  });
  await widenPortalVendorStorage(db);
  await store.importLegacyVendorBanks();
  assert.deepEqual(changes, [{ table: 'vendor_bank_details', column: 'BANKID' }, { table: 'vendor_bank_details', column: 'PHONE_NUMBER' }]);
  assert.equal(records.get('V1').phoneNumber, 'portal-edited-contact');
  assert.equal(records.get('V2').phoneNumber, contact);
  assert.equal(records.get('V2').bankid, bankName);
  assert.equal(records.get('V3').phoneNumber, '0012345678');
  assert.equal(sageQueries.every(sql => /^SELECT/.test(sql)), true);
});

test('storage upgrade preserves identity, JSON addresses and existing LONGTEXT and cannot run on SQL Server', async () => {
  await widenPortalVendorStorage({ getDialect: () => 'mysql', getQueryInterface: () => ({
    describeTable: async () => ({
      BANKID: { type: 'LONGTEXT', allowNull: true }, PHONE_NUMBER: { type: 'LONGTEXT', allowNull: true },
      VENDORID: { type: 'VARCHAR(12)', allowNull: false, primaryKey: true },
      PHYSICAL_ADDRESS: { type: 'JSON', allowNull: true }, ID: { type: 'INT', allowNull: false },
    }),
    changeColumn: () => assert.fail('must not alter identity, addresses or existing LONGTEXT'),
  }) });
  await assert.rejects(widenPortalVendorStorage({ getDialect: () => 'mssql', getQueryInterface: () => assert.fail('must not inspect or modify SQL Server') }), /restricted to portal MySQL/);
});

test('pre-existing text widths are widened consistently without changing nullability or default values', async () => {
  for (const type of ['VARCHAR(20)', 'VARCHAR(255)', 'VARCHAR(512)', 'CHAR(20)', 'TINYTEXT', 'TEXT', 'MEDIUMTEXT']) {
    let changes = 0;
    await widenPortalVendorStorage({ getDialect: () => 'mysql', getQueryInterface: () => ({
      describeTable: async () => ({ BANKID: { type, allowNull: true, defaultValue: null } }),
      changeColumn: async (table, column, definition) => {
        changes++; assert.equal(table, 'vendor_bank_details'); assert.equal(column, 'BANKID');
        assert.equal(definition.type.toString(), 'LONGTEXT'); assert.equal(definition.allowNull, true); assert.equal(definition.defaultValue, null);
      },
    }) });
    assert.equal(changes, 1);
  }
});

test('import diagnostics distinguish a MySQL save failure from a Sage read failure and exclude values', () => {
  const error = { cause: { original: { code: 'ER_DATA_TOO_LONG', errno: 1406,
    sqlMessage: "Data too long for column 'PHONE_NUMBER' at row 1", parameters: ['private-contact-value'] } } };
  assert.equal(JSON.stringify(bankRead.vendorBankFailureDetails(error)).includes('private-contact-value'), false);
  assert.match(bankRead.vendorBankReadError(error), /portal MySQL vendor column is too short/);
});
