import mysql2 from 'mysql2';
import { Sequelize } from 'sequelize-typescript';
import { User } from '../models/internal/User';
import { PaymentQueueRequest } from '../models/internal/PaymentQueueRequest';
import { CashbookReceipt } from '../models/internal/CashbookReceipt';
import { ProcessedTransaction } from '../models/internal/Processed_transactions';

const host = process.env.DB_HOST ?? 'localhost';
const port = Number(process.env.DB_PORT ?? 3306);
const username = process.env.DB_USER ?? 'root';
const password = process.env.DB_PASSWORD ?? '';
const database = process.env.DB_NAME ?? 'host2host';

// Prevent automatic sync on requests. Use syncDatabase() manually when needed.
process.env.DB_SYNC = 'false';

const sequelize = new Sequelize({
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

export async function connectDatabase(): Promise<void> {
  try {
    await sequelize.authenticate();
  } catch (error) {
    console.error('Unable to connect to MySQL database:', error);
    throw error;
  }
}

export async function syncDatabase(): Promise<void> {
  try {
    await sequelize.authenticate();
    if (process.env.DB_SYNC === 'true') {
      await sequelize.sync({ alter: true });
    }
  } catch (error) {
    console.error('Unable to sync MySQL database:', error);
    throw error;
  }
}

export default sequelize;
