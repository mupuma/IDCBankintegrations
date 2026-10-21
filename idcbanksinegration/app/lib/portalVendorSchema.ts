import { DataTypes, type Sequelize } from 'sequelize';

// A targeted widening on the portal database only. The general schema sync
// remains add-only; never apply ORM alter-sync to existing Sage tables.
export async function widenPortalVendorPhone(instance: Sequelize): Promise<void> {
  if (instance.getDialect() !== 'mysql') throw new Error('Vendor contact storage upgrades are restricted to portal MySQL');
  const qi = instance.getQueryInterface();
  const columns = await qi.describeTable('vendor_bank_details');
  const entry = Object.entries(columns).find(([name]) => name.toUpperCase() === 'PHONE_NUMBER');
  if (!entry) return;
  const [column, definition] = entry;
  const match = /^VARCHAR\((\d+)\)/i.exec(definition.type);
  if (!match || Number(match[1]) >= 255) return;
  await qi.changeColumn('vendor_bank_details', column, {
    type: DataTypes.STRING(255), allowNull: definition.allowNull,
    ...(definition.defaultValue !== undefined ? { defaultValue: definition.defaultValue } : {}),
  });
  console.log('Widened portal MySQL vendor_bank_details.PHONE_NUMBER to VARCHAR(255); existing values preserved');
}
