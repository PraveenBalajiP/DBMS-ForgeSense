import mysql from 'mysql2/promise';
import { requireMysqlEnv } from '../config/env.js';

const g = globalThis;
function pool() {
  if (!g.__mysqlPool) {
    requireMysqlEnv();
    g.__mysqlPool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 10,
      dateStrings: true,
      decimalNumbers: true,
    });
  }
  return g.__mysqlPool;
}
export const endPool = () => (g.__mysqlPool ? g.__mysqlPool.end() : Promise.resolve());

// Parameterised query helper: `?` placeholders prevent SQL injection.
export async function q(sql, params = []) {
  const [rows] = await pool().query(sql, params);
  return rows;
}

// CALL returns [resultSetRows, OkPacket]; we return the first row of the first result set.
export async function callProc(name, params = []) {
  const marks = params.map(() => '?').join(',');
  const [res] = await pool().query(`CALL ${name}(${marks})`, params);
  return Array.isArray(res) && Array.isArray(res[0]) ? res[0][0] : res[0];
}
