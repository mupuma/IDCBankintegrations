// import mysql2 from 'mysql2';
// import dotenv from 'dotenv';
// import { Sequelize } from 'sequelize-typescript';
// import { User } from '../models/internal/User';
// import { PaymentQueueRequest } from '../models/internal/PaymentQueueRequest';
// import { CashbookReceipt } from '../models/internal/CashbookReceipt';
// import { ProcessedTransaction } from '../models/internal/Processed_transactions';
// dotenv.config();
// const host = process.env.DB_HOST ?? 'localhost';
// const port = Number(process.env.DB_PORT ?? 3306);
// const username = process.env.DB_USER ?? 'root';
// const password = process.env.DB_PASSWORD ?? '';
// const database = process.env.DB_NAME ?? 'host2host';

// // Prevent automatic sync on requests. Use syncDatabase() manually when needed.
// process.env.DB_SYNC = 'false';

// const sequelize = new Sequelize({
//   dialect: 'mysql',
//   dialectModule: mysql2,
//   host,
//   port,
//   username,
//   password,
//   database,
//   models: [User, PaymentQueueRequest, CashbookReceipt, ProcessedTransaction],
//   logging: false,
//   define: {
//     underscored: true,
//   },
// });

// export async function connectDatabase(): Promise<void> {
//   try {
//     await sequelize.authenticate();
//   } catch (error) {
//     console.error('Unable to connect to MySQL database:', error);
//     throw error;
//   }
// }

// export async function syncDatabase(): Promise<void> {
//   try {
//     await sequelize.authenticate();
//     if (process.env.DB_SYNC === 'true') {
//       await sequelize.sync({ alter: true });
//     }
//   } catch (error) {
//     console.error('Unable to sync MySQL database:', error);
//     throw error;
//   }
// }

// export default sequelize;




import mysql2 from 'mysql2';
import dotenv from 'dotenv';
import { Sequelize } from 'sequelize-typescript';
import { User } from '../models/internal/User';
import { PaymentQueueRequest } from '../models/internal/PaymentQueueRequest';
import { CashbookReceipt } from '../models/internal/CashbookReceipt';
import { ProcessedTransaction } from '../models/internal/Processed_transactions';

dotenv.config();

// Don't initialize at top level - use a variable to hold the instance
let sequelizeInstance: Sequelize | null = null;

// Function to get or create the Sequelize instance
function getSequelizeInstance(): Sequelize {
  if (!sequelizeInstance) {
    // Only read env vars and create connection when first needed
    const host = process.env.DB_HOST ?? 'localhost';
    const port = Number(process.env.DB_PORT ?? 3306);
    const username = process.env.DB_USER ?? 'root';
    const password = process.env.DB_PASSWORD ?? '';
    const database = process.env.DB_NAME ?? 'host2host';

    console.log(`Initializing database connection to ${host}:${port}/${database} as ${username}`);
    
    sequelizeInstance = new Sequelize({
      dialect: 'mysql',
      dialectModule: mysql2,
      host,
      port,
      username,
      password,
      database,
      models: [User, PaymentQueueRequest, CashbookReceipt, ProcessedTransaction],
      logging: false,
      define: {
        underscored: true,
      },
    });
  }
  return sequelizeInstance;
}

// Export a proxy that initializes lazily
const sequelize = new Proxy({} as Sequelize, {
  get(target, prop) {
    // When any property is accessed, initialize the real instance
    const instance = getSequelizeInstance();
    const value = instance[prop as keyof Sequelize];
    return typeof value === 'function' ? value.bind(instance) : value;
  }
});

export async function connectDatabase(): Promise<void> {
  try {
    const instance = getSequelizeInstance();
    await instance.authenticate();
    console.log('Database connection established successfully');
  } catch (error) {
    console.error('Unable to connect to MySQL database:', error);
    throw error;
  }
}

export async function syncDatabase(): Promise<void> {
  try {
    const instance = getSequelizeInstance();
    await instance.authenticate();
    if (process.env.DB_SYNC === 'true') {
      await instance.sync({ alter: true });
      console.log('Database sync completed');
    }
  } catch (error) {
    console.error('Unable to sync MySQL database:', error);
    throw error;
  }
}

// Also export a function to get the raw instance if needed
export async function getSequelize(): Promise<Sequelize> {
  return getSequelizeInstance();
}

// For backward compatibility, but discourage direct import
export default sequelize;