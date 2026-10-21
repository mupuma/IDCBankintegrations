const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/portal.cjs');
const prefix = 'idcbanksinegration/app/lib/';
const { widenPortalVendorPhone } = load(prefix + 'portalVendorSchema.ts');
const bankRead = load(prefix + 'vendorBankRead.ts');
const { assertSageQueryAllowed } = load(prefix + 'sageQueryPolicy.ts');

test('widening portal MySQL restores import of multi-number Sage contacts without truncation or changing saved edits', async () => {
  let width = 20;
  const changes = [], sageQueries = [];
  const contact = '+260211000000/260977000000';
  const records = new Map([['V1', { vendorid: 'V1', phoneNumber: 'portal-edited-contact' }]]);
  const db = {
    getDialect: () => 'mysql', getQueryInterface: () => ({
      describeTable: async () => ({ PHONE_NUMBER: { type: `VARCHAR(${width})`, allowNull: true, defaultValue: null } }),
      changeColumn: async (table, column, definition) => { changes.push({ table, column }); width = definition.type.options.length; },
    }),
  };
  const store = load(prefix + 'vendorBankStore.ts', {
    './db': { connectDatabase: async () => {} },
    './sageDb': { __esModule: true, connectSageDatabase: async () => {}, default: { query: async sql => {
      assertSageQueryAllowed(sql, false); sageQueries.push(sql);
      if (sql.includes('sys.columns')) return ['VENDORID', 'ACCNAME', 'PHONE_NUMBER'].map(name => ({ name }));
      return [{ vendorid: 'V1', accname: 'Source vendor', phoneNumber: 'old contact' },
        { vendorid: 'V2', accname: 'Multi-number vendor', phoneNumber: contact },
        { vendorid: 'V3', accname: 'Following vendor', phoneNumber: '0012345678' }];
    } } },
    '../models/internal/VendorBankDetail': { VendorBankDetail: { findOrCreate: async ({ where, defaults }) => {
      if (records.has(where.vendorid)) return [records.get(where.vendorid), false];
      if (defaults.phoneNumber.length > width) throw Object.assign(new Error('Data too long for column \'PHONE_NUMBER\' at row 1'), {
        original: { code: 'ER_DATA_TOO_LONG', errno: 1406, sqlMessage: "Data too long for column 'PHONE_NUMBER' at row 1" },
      });
      records.set(where.vendorid, defaults); return [defaults, true];
    } } },
    './vendorBankRead': bankRead,
  });
  await assert.rejects(store.importLegacyVendorBanks(), error => {
    assert.equal(error.importStage, 'portal_save');
    assert.deepEqual(bankRead.vendorBankFailureDetails(error), { code: 'ER_DATA_TOO_LONG', number: 1406, column: 'PHONE_NUMBER' });
    return true;
  });
  await widenPortalVendorPhone(db);
  await store.importLegacyVendorBanks();
  assert.deepEqual(changes, [{ table: 'vendor_bank_details', column: 'PHONE_NUMBER' }]);
  assert.equal(records.get('V1').phoneNumber, 'portal-edited-contact');
  assert.equal(records.get('V2').phoneNumber, contact);
  assert.equal(records.get('V3').phoneNumber, '0012345678');
  assert.equal(sageQueries.every(sql => /^SELECT/.test(sql)), true);
});

test('phone upgrade never narrows an existing wider column and cannot run on SQL Server', async () => {
  for (const type of ['VARCHAR(255)', 'VARCHAR(512)', 'TEXT', 'LONGTEXT']) {
    await widenPortalVendorPhone({ getDialect: () => 'mysql', getQueryInterface: () => ({
      describeTable: async () => ({ PHONE_NUMBER: { type, allowNull: true } }),
      changeColumn: () => assert.fail('must not narrow existing columns'),
    }) });
  }
  await assert.rejects(widenPortalVendorPhone({ getDialect: () => 'mssql', getQueryInterface: () => assert.fail('must not inspect or modify SQL Server') }), /restricted to portal MySQL/);
});

test('import diagnostics distinguish a MySQL save failure from a Sage read failure and exclude values', () => {
  const error = { cause: { original: { code: 'ER_DATA_TOO_LONG', errno: 1406,
    sqlMessage: "Data too long for column 'PHONE_NUMBER' at row 1", parameters: ['private-contact-value'] } } };
  assert.equal(JSON.stringify(bankRead.vendorBankFailureDetails(error)).includes('private-contact-value'), false);
  assert.match(bankRead.vendorBankReadError(error), /portal MySQL vendor column is too short/);
});
