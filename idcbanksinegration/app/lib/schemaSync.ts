import type { Model, ModelStatic, Sequelize } from 'sequelize';
import type { AbstractDataTypeConstructor } from 'sequelize/types';

type RegisteredModel = ModelStatic<Model> & { tableName: string };

async function tableExists(queryInterface: ReturnType<Sequelize['getQueryInterface']>, tableName: string): Promise<boolean> {
  const tables = await queryInterface.showAllTables();
  const normalized = tableName.toLowerCase();
  return tables.some((table) => {
    const name = typeof table === 'string' ? table : (table as { tableName?: string }).tableName ?? String(table);
    return name.toLowerCase() === normalized;
  });
}

function buildColumnDefinition(attribute: {
  type: AbstractDataTypeConstructor | unknown;
  allowNull?: boolean;
  defaultValue?: unknown;
  autoIncrement?: boolean;
}) {
  return {
    type: attribute.type as AbstractDataTypeConstructor,
    allowNull: attribute.allowNull !== false,
    ...(attribute.defaultValue !== undefined ? { defaultValue: attribute.defaultValue } : {}),
    ...(attribute.autoIncrement ? { autoIncrement: attribute.autoIncrement } : {}),
  };
}

export async function syncSchemaAddOnly(instance: Sequelize, models: RegisteredModel[]): Promise<void> {
  const queryInterface = instance.getQueryInterface();

  for (const model of models) {
    const tableName = model.tableName;
    const exists = await tableExists(queryInterface, tableName);

    if (!exists) {
      await model.sync();
      console.log(`Created table: ${tableName}`);
      continue;
    }

    const tableDescription = await queryInterface.describeTable(tableName);
    const attributes = model.getAttributes();

    for (const [attrName, attribute] of Object.entries(attributes)) {
      const columnName = (attribute.field as string | undefined) ?? attrName;
      if (tableDescription[columnName]) {
        continue;
      }

      await queryInterface.addColumn(tableName, columnName, buildColumnDefinition(attribute));
      console.log(`Added column: ${tableName}.${columnName}`);
    }
  }
}
