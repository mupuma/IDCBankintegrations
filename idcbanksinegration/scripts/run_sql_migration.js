const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function run() {
  const file = path.join(__dirname, '..', 'sql', 'add_source_bank_to_payment_queue_requests.sql');
  const sql = fs.readFileSync(file, 'utf8');

  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'host2host';

  let conn;
  try {
    conn = await mysql.createConnection({ host, port, user, password, database, multipleStatements: true });
    console.log('Connected to DB, running migration...');
    const [result] = await conn.query(sql);
    console.log('Migration applied.');
    await conn.end();
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    if (conn) await conn.end().catch(() => {});
    process.exit(1);
  }
}

run();
