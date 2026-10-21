const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/portal.cjs');
const prefix = 'idcbanksinegration/app/';
const policy = load(prefix + 'lib/sageQueryPolicy.ts');

test('Sage connection authenticates without schema SQL even when the old sync flag is enabled', async () => {
  const calls = [];
  const mocks = {
    tedious: {},
    'sequelize-typescript': { Sequelize: class {
      constructor() { this.query = async sql => { calls.push(sql); return []; }; }
      async authenticate() { await this.query('SELECT 1+1 AS result'); }
    } },
    './sageQueryPolicy': policy,
  };
  for (const model of ['Appym', 'Aptcr', 'Apven', 'Arcus', 'Arobl', 'Bkacct', 'Cbbctl', 'Cbbtdt', 'Cbbthd', 'Cbbtm', 'Cboptio']) {
    mocks[`../models/sage_entities/${model}`] = { [model]: {} };
  }
  const previous = process.env.SAGE_SYNC_VENBANK_SCHEMA;
  const previousCashbook = process.env.SAGE_ALLOW_CASHBOOK_WRITES;
  try {
    process.env.SAGE_SYNC_VENBANK_SCHEMA = 'true';
    delete process.env.SAGE_ALLOW_CASHBOOK_WRITES;
    const db = load(prefix + 'lib/sageDb.ts', mocks);
    await db.connectSageDatabase();
    assert.deepEqual(calls, ['SELECT 1+1 AS result']);
    assert.throws(() => db.default.query('ALTER TABLE VENBANK ADD TPIN VARCHAR(20)'), /changes are disabled/);
    assert.throws(() => db.default.query('CREATE TABLE VENBANK (ID INT)'), /changes are disabled/);
    assert.equal(calls.length, 1);
    await db.default.query('BEGIN TRANSACTION');
    await db.default.query('INSERT INTO CBBTHD (BTCHENTRY) VALUES (1)');
    await db.default.query('UPDATE CBBCTL SET CNTBTCH = 2');
    await db.default.query('COMMIT TRANSACTION');
    assert.equal(calls.length, 5);
    process.env.SAGE_ALLOW_CASHBOOK_WRITES = 'false';
    assert.throws(() => db.default.query('INSERT INTO CBBTHD (BTCHENTRY) VALUES (1)'), /read-only/);
    assert.equal(calls.length, 5);
  } finally {
    if (previous === undefined) delete process.env.SAGE_SYNC_VENBANK_SCHEMA;
    else process.env.SAGE_SYNC_VENBANK_SCHEMA = previous;
    if (previousCashbook === undefined) delete process.env.SAGE_ALLOW_CASHBOOK_WRITES;
    else process.env.SAGE_ALLOW_CASHBOOK_WRITES = previousCashbook;
  }
});

test('Sage query policy blocks schema changes, dynamic execution and writes, including SELECT INTO', () => {
  for (const sql of [
    'ALTER TABLE VENBANK ADD TPIN INT', 'CREATE TABLE X (ID INT)', 'DROP TABLE X',
    'TRUNCATE TABLE X', 'EXEC sp_executesql @query', 'GRANT ALTER ON X TO Y',
    'SELECT 1; DELETE FROM APVEN', 'WITH x AS (SELECT 1 AS id) UPDATE APVEN SET TAXNBR=1',
    'SELECT * INTO copy FROM APVEN', 'INSERT INTO APVEN (VENDORID) VALUES (1)',
  ]) assert.throws(() => policy.assertSageQueryAllowed(sql, false));
  for (const sql of ['CREATE TABLE X (ID INT)', 'ALTER TABLE X ADD N INT', 'DROP TABLE X', 'EXEC @sql', 'SELECT * INTO copy FROM APVEN']) {
    assert.throws(() => policy.assertSageQueryAllowed(sql, true), /changes are disabled/);
    assert.throws(() => policy.assertSageQueryAllowed(sql), /changes are disabled/);
  }
  for (const sql of [
    'SELECT * FROM APVEN', "SELECT 'ALTER TABLE' AS [update] FROM APVEN",
    '-- read-only\nSELECT VENDORID FROM APVEN',
    'WITH vendors AS (SELECT VENDORID FROM APVEN) SELECT * FROM vendors',
  ]) assert.doesNotThrow(() => policy.assertSageQueryAllowed(sql));
});

test('legacy vendor import reads only existing SQL Server columns and writes exclusively to MySQL without overwriting portal edits', async () => {
  const sql = [], local = new Map([['V1', { vendorid: 'V1', accname: 'Portal correction', tpin: '00123' }]]);
  const findOptions = [];
  const store = load(prefix + 'lib/vendorBankStore.ts', {
    './db': { connectDatabase: async () => {} },
    './sageVendorSync': { syncSageVendorMaster: async () => ({ sageVendorCount: 0, addedCount: 0 }) },
    './sageDb': { __esModule: true, connectSageDatabase: async () => {}, default: { query: async query => {
      policy.assertSageQueryAllowed(query); sql.push(query);
      if (query.includes('sys.columns')) return ['VENDORID', 'ACCVEN', 'ACCNAME', 'PHYSICAL_ADDRESS'].map(name => ({ name }));
      return [{ vendorid: ' V1 ', accname: 'Old Sage name' }, { vendorid: 'V2', accven: '001122', accname: 'Sage vendor', physicalAddress: 'Main Street' }];
    } } },
    '../models/internal/VendorBankDetail': { VendorBankDetail: { findOrCreate: async options => {
      findOptions.push(options); if (!local.has(options.where.vendorid)) local.set(options.where.vendorid, options.defaults);
    } } },
    './vendorBankRead': load(prefix + 'lib/vendorBankRead.ts'),
  });
  await store.importLegacyVendorBanks();
  assert.equal(sql.length, 2); assert.equal(sql.every(query => /^SELECT/.test(query)), true);
  assert.equal(sql[1].includes('[TPIN]'), false);
  assert.equal(local.get('V1').accname, 'Portal correction'); assert.equal(local.get('V1').tpin, '00123');
  assert.equal(local.get('V2').accven, '001122');
  assert.equal(local.get('V2').physicalAddress.streetName, 'Main Street');
  assert.equal(findOptions.every(options => options.paranoid === false), true);
});

test('missing or hidden Sage VENBANK never triggers table creation', async () => {
  const sql = [];
  const store = load(prefix + 'lib/vendorBankStore.ts', {
    './db': { connectDatabase: async () => {} },
    './sageVendorSync': { syncSageVendorMaster: async () => ({ sageVendorCount: 0, addedCount: 0 }) },
    './sageDb': { __esModule: true, connectSageDatabase: async () => {}, default: { query: async query => { sql.push(query); return []; } } },
    '../models/internal/VendorBankDetail': { VendorBankDetail: { findOrCreate: () => assert.fail('no legacy rows to copy') } },
    './vendorBankRead': load(prefix + 'lib/vendorBankRead.ts'),
  });
  await store.importLegacyVendorBanks(); assert.equal(sql.length, 1); assert.match(sql[0], /^SELECT/);
});
