import Database from "better-sqlite3";
import * as path from "path";
import * as fs from "fs";

export const DB_PATH = path.join(__dirname, "..", "data", "metrics.db");

export function initializeDatabase(dbPath?: string): Database.Database {
  const resolvedPath = dbPath || DB_PATH;
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(resolvedPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chain_agent_id INTEGER,
      owner TEXT NOT NULL,
      agent_address TEXT NOT NULL UNIQUE,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS intents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chain_intent_id INTEGER,
      agent_address TEXT NOT NULL,
      intent_type TEXT NOT NULL CHECK (intent_type IN ('SWAP', 'TRANSFER')),
      token_in TEXT,
      token_out TEXT,
      amount_in TEXT,
      status TEXT DEFAULT 'PENDING',
      created_at TEXT DEFAULT (datetime('now')),
      executed_at TEXT,
      deadline TEXT,
      tx_hash TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tx_hash TEXT NOT NULL,
      batch_size INTEGER NOT NULL,
      intent_count INTEGER NOT NULL,
      success_count INTEGER NOT NULL,
      failed_count INTEGER NOT NULL,
      gas_used INTEGER NOT NULL,
      confirmed_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS benchmark_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mode TEXT NOT NULL CHECK (mode IN ('baseline', 'batching')),
      batch_size INTEGER NOT NULL,
      total_intents INTEGER NOT NULL,
      total_txs INTEGER NOT NULL,
      avg_gas_per_intent REAL NOT NULL,
      avg_latency_ms REAL NOT NULL,
      throughput REAL NOT NULL,
      failed_rate REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  return db;
}

export function getDatabase(dbPath?: string): Database.Database {
  const resolvedPath = dbPath || DB_PATH;
  if (!fs.existsSync(resolvedPath)) {
    return initializeDatabase(resolvedPath);
  }
  return new Database(resolvedPath);
}
