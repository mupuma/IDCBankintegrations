import { DataTypes, type Sequelize } from 'sequelize';

export const VENDOR_SOURCE_TEXT_COLUMNS = [
  'ACCVEN', 'ACCNAME', 'BANKID', 'SORTCDE', 'BRNCH', 'SWIFTCDE',
  'TPIN', 'PURPOSE_CODE', 'SECTOR_CODE', 'COUNTRY_OF_ORIGIN', 'EMAIL', 'PHONE_NUMBER',
] as const;

// Source storage must not enforce bank payload limits. Preserve the imported
// text; bank-specific account/code/length validation runs before payment posting.
// VENDORID and its unique index, JSON addresses and timestamps are not changed.
export async function widenPortalVendorStorage(instance: Sequelize): Promise<void> {
  if (instance.getDialect() !== 'mysql') throw new Error('Vendor storage upgrades are restricted to portal MySQL');
  const qi = instance.getQueryInterface();
  const columns = await qi.describeTable('vendor_bank_details');
  for (const [column, definition] of Object.entries(columns)) {
    if (!(VENDOR_SOURCE_TEXT_COLUMNS as readonly string[]).includes(column.toUpperCase())) continue;
    if (!/^(?:VAR)?CHAR\(\d+\)|^(?:TINY|MEDIUM)?TEXT$/i.test(definition.type)) continue;
    await qi.changeColumn('vendor_bank_details', column, {
      type: DataTypes.TEXT('long'), allowNull: definition.allowNull,
      ...(definition.defaultValue !== undefined ? { defaultValue: definition.defaultValue } : {}),
    });
    console.log(`Widened portal MySQL vendor_bank_details.${column} to LONGTEXT; existing values preserved`);
  }
}
