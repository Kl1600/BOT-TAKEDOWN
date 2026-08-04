import { DatabaseSync } from 'node:sqlite';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import * as logger from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '../../database.sqlite');

// Create db directory if not exists
const dbDir = dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

function ensureDatabaseFile() {
  if (!fs.existsSync(dbPath)) {
    fs.closeSync(fs.openSync(dbPath, 'a'));
  }
}

function openDatabase() {
  ensureDatabaseFile();
  const database = new DatabaseSync(dbPath);
  database.exec('PRAGMA foreign_keys = ON;');
  return database;
}

let db;

try {
  db = openDatabase();
} catch (err) {
  logger.error(`Impossible d'ouvrir la base SQLite: ${err?.message || err}`);
  throw err;
}

/**
 * Execute a query that returns multiple rows (SELECT)
 */
export const query = (sql, params = []) => {
  return Promise.resolve(db.prepare(sql).all(...params));
};

/**
 * Execute a query that returns a single row (SELECT LIMIT 1)
 */
export const get = (sql, params = []) => {
  return Promise.resolve(db.prepare(sql).get(...params) ?? null);
};

/**
 * Execute a query that modifies the database (INSERT, UPDATE, DELETE)
 */
export const run = (sql, params = []) => {
  const result = db.prepare(sql).run(...params);
  return Promise.resolve({ id: Number(result.lastInsertRowid) || 0, changes: result.changes || 0 });
};

export default {
  query,
  get,
  run,
  dbInstance: db
};
