import type { DataType, Model, ModelAttributeColumnOptions, ModelStatic, Sequelize } from 'sequelize';

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
  type: unknown;
  allowNull?: boolean;
  defaultValue?: unknown;
  autoIncrement?: boolean;
}): ModelAttributeColumnOptions {
  return {
    type: attribute.type as DataType,
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
      await model.sync({ force: false, alter: false });
      console.log(`Created table: ${tableName}`);
      continue;
    }

    const tableDescription = await queryInterface.describeTable(tableName);
    const existingColumns = new Set(Object.keys(tableDescription).map(name => name.toLowerCase()));
    const attributes = model.getAttributes();

    for (const [attrName, attribute] of Object.entries(attributes)) {
      const columnName = (attribute.field as string | undefined) ?? attrName;
      if (existingColumns.has(columnName.toLowerCase())) {
        continue;
      }

      await queryInterface.addColumn(tableName, columnName, buildColumnDefinition(attribute));
      console.log(`Added column: ${tableName}.${columnName}`);
    }
  }
}
