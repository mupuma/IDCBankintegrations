import tedious from 'tedious';
import { Sequelize } from 'sequelize-typescript';
import { Appym } from '../models/sage_entities/Appym';
import { Aptcr } from '../models/sage_entities/Aptcr';
import { Apven } from '../models/sage_entities/Apven';
import { Arcus } from '../models/sage_entities/Arcus';
import { Arobl } from '../models/sage_entities/Arobl';
import { Bkacct } from '../models/sage_entities/Bkacct';
import { Cbbctl } from '../models/sage_entities/Cbbctl';
import { Cbbtdt } from '../models/sage_entities/Cbbtdt';
import { Cbbthd } from '../models/sage_entities/Cbbthd';
import { Cbbtm } from '../models/sage_entities/Cbbtm';
import { Cboptio } from '../models/sage_entities/Cboptio';
import { Venbank } from '../models/sage_entities/Venbank';

const host = process.env.SAGE_DB_HOST ?? 'localhost';
const port = Number(process.env.SAGE_DB_PORT ?? 50593);
const username = process.env.SAGE_DB_USER ?? 'sa';
const password = process.env.SAGE_DB_PASSWORD ?? 'Brighton13';
const database = process.env.SAGE_DB_NAME ?? 'INDCOM';

const sageSequelize = new Sequelize({
  dialect: 'mssql',
  dialectModule: tedious,
  host,
  port,
  username,
  password,
  database,
  models: [
    Appym,
    Aptcr,
    Apven,
    Arcus,
    Arobl,
    Bkacct,
    Cbbctl,
    Cbbtdt,
    Cbbthd,
    Cbbtm,
    Cboptio,
    Venbank,
  ],
  logging: false,
  define: {
    underscored: false,
  },
  dialectOptions: {
    options: {
      encrypt: process.env.SAGE_DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.SAGE_DB_TRUST_CERT === 'true',
      requestTimeout: Number(process.env.SAGE_DB_REQUEST_TIMEOUT_MS ?? 60000),
      connectTimeout: Number(process.env.SAGE_DB_CONNECT_TIMEOUT_MS ?? 30000),
    },
  },
});

export async function connectSageDatabase(): Promise<void> {
  try {
    await sageSequelize.authenticate();
  } catch (error) {
    console.error('Unable to connect to Sage database:', error);
    throw error;
  }
}

export default sageSequelize;
