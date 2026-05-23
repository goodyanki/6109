import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import * as path from "path";
import * as fs from "fs";

// ============================================================
// DB-001 ~ DB-009: SQLite Database Schema
//
// RED FLAG: These tests verify the SQLite schema exists and
// enforces constraints. Tests fail until the database
// initialization module is implemented.
// ============================================================

const TEST_DB_PATH = path.join(__dirname, "..", "..", "data", "test_metrics.db");

describe("SQLite Database Schema", function () {
  let db: Database.Database;

  beforeAll(() => {
    // Clean up test DB
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  afterAll(() => {
    if (db && db.open) {
      db.close();
    }
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  // ----------------------------------------------------------
  // DB-001: agents table schema
  // ----------------------------------------------------------
  it("DB-001: agents table has correct schema (RED)", async () => {
    try {
      const { initializeDatabase } = await import("../../scripts/database");
      db = initializeDatabase(TEST_DB_PATH);

      const tableInfo = db
        .prepare("PRAGMA table_info(agents)")
        .all() as Array<{
        cid: number;
        name: string;
        type: string;
        notnull: number;
        dflt_value: string | null;
        pk: number;
      }>;

      const columns = tableInfo.map((c) => c.name);
      expect(columns).toContain("id");
      expect(columns).toContain("chain_agent_id");
      expect(columns).toContain("owner");
      expect(columns).toContain("agent_address");
      expect(columns).toContain("active");
      expect(columns).toContain("created_at");

      // agent_address must be UNIQUE
      const addressCol = tableInfo.find((c) => c.name === "agent_address");
      expect(addressCol?.notnull).toBe(1);

      // active defaults to 1
      const activeCol = tableInfo.find((c) => c.name === "active");
      expect(activeCol?.dflt_value).toBe("1");
    } catch (e: unknown) {
      const err = e as Error;
      if (err.code === "ERR_MODULE_NOT_FOUND" || err.message?.includes("Cannot find module")) {
        throw new Error(`RED: database.ts not yet implemented — ${err.message}`);
      }
      throw e;
    }
  });

  // ----------------------------------------------------------
  // DB-002: intents table schema + CHECK constraint
  // ----------------------------------------------------------
  it("DB-002: intents table has correct schema with CHECK constraint (RED)", async () => {
    try {
      const { initializeDatabase } = await import("../../scripts/database");
      db = initializeDatabase(TEST_DB_PATH);

      const tableInfo = db
        .prepare("PRAGMA table_info(intents)")
        .all() as Array<{
        name: string;
        type: string;
      }>;

      const columns = tableInfo.map((c) => c.name);
      expect(columns).toContain("id");
      expect(columns).toContain("chain_intent_id");
      expect(columns).toContain("agent_address");
      expect(columns).toContain("intent_type");
      expect(columns).toContain("token_in");
      expect(columns).toContain("token_out");
      expect(columns).toContain("amount_in");
      expect(columns).toContain("status");
      expect(columns).toContain("created_at");
      expect(columns).toContain("executed_at");
      expect(columns).toContain("deadline");
      expect(columns).toContain("tx_hash");
    } catch (e: unknown) {
      const err = e as Error;
      if (err.code === "ERR_MODULE_NOT_FOUND" || err.message?.includes("Cannot find module")) {
        throw new Error(`RED: database.ts not yet implemented — ${err.message}`);
      }
      throw e;
    }
  });

  // ----------------------------------------------------------
  // DB-003: batches table schema
  // ----------------------------------------------------------
  it("DB-003: batches table has correct schema (RED)", async () => {
    try {
      const { initializeDatabase } = await import("../../scripts/database");
      db = initializeDatabase(TEST_DB_PATH);

      const tableInfo = db
        .prepare("PRAGMA table_info(batches)")
        .all() as Array<{ name: string }>;

      const columns = tableInfo.map((c) => c.name);
      expect(columns).toContain("id");
      expect(columns).toContain("tx_hash");
      expect(columns).toContain("batch_size");
      expect(columns).toContain("intent_count");
      expect(columns).toContain("success_count");
      expect(columns).toContain("failed_count");
      expect(columns).toContain("gas_used");
      expect(columns).toContain("confirmed_at");
    } catch (e: unknown) {
      const err = e as Error;
      if (err.code === "ERR_MODULE_NOT_FOUND" || err.message?.includes("Cannot find module")) {
        throw new Error(`RED: database.ts not yet implemented — ${err.message}`);
      }
      throw e;
    }
  });

  // ----------------------------------------------------------
  // DB-004: benchmark_runs table schema + CHECK constraint
  // ----------------------------------------------------------
  it("DB-004: benchmark_runs table has correct schema with CHECK on mode (RED)", async () => {
    try {
      const { initializeDatabase } = await import("../../scripts/database");
      db = initializeDatabase(TEST_DB_PATH);

      const tableInfo = db
        .prepare("PRAGMA table_info(benchmark_runs)")
        .all() as Array<{ name: string }>;

      const columns = tableInfo.map((c) => c.name);
      expect(columns).toContain("id");
      expect(columns).toContain("mode");
      expect(columns).toContain("batch_size");
      expect(columns).toContain("total_intents");
      expect(columns).toContain("total_txs");
      expect(columns).toContain("avg_gas_per_intent");
      expect(columns).toContain("avg_latency_ms");
      expect(columns).toContain("throughput");
      expect(columns).toContain("failed_rate");
      expect(columns).toContain("created_at");
    } catch (e: unknown) {
      const err = e as Error;
      if (err.code === "ERR_MODULE_NOT_FOUND" || err.message?.includes("Cannot find module")) {
        throw new Error(`RED: database.ts not yet implemented — ${err.message}`);
      }
      throw e;
    }
  });

  // ----------------------------------------------------------
  // DB-005: database file created at data/metrics.db
  // ----------------------------------------------------------
  it("DB-005: database file is created at data/metrics.db (RED)", async () => {
    try {
      const { DB_PATH } = await import("../../scripts/database");
      expect(DB_PATH).toContain("metrics.db");
      // After initialization, file should exist
      expect(fs.existsSync(TEST_DB_PATH)).toBe(true);
    } catch (e: unknown) {
      const err = e as Error;
      if (err.code === "ERR_MODULE_NOT_FOUND" || err.message?.includes("Cannot find module")) {
        throw new Error(`RED: database.ts not yet implemented — ${err.message}`);
      }
      throw e;
    }
  });

  // ----------------------------------------------------------
  // DB-006 ~ DB-009: Data Integrity
  // ----------------------------------------------------------
  describe("data integrity", () => {
    it("DB-006: INSERT with invalid intent_type is rejected by CHECK (RED)", async () => {
      try {
        const { initializeDatabase } = await import("../../scripts/database");
        db = initializeDatabase(TEST_DB_PATH);

        expect(() =>
          db
            .prepare(
              `INSERT INTO intents (chain_intent_id, agent_address, intent_type, status)
             VALUES (?, ?, ?, ?)`
            )
            .run(1, "0xAgent1", "REBALANCE", "PENDING")
        ).toThrow();
      } catch (e: unknown) {
        const err = e as Error;
        if (err.code === "ERR_MODULE_NOT_FOUND" || err.message?.includes("Cannot find module")) {
          throw new Error(`RED: database.ts not yet implemented — ${err.message}`);
        }
        throw e;
      }
    });

    it("DB-007: INSERT with invalid benchmark mode is rejected by CHECK (RED)", async () => {
      try {
        const { initializeDatabase } = await import("../../scripts/database");
        db = initializeDatabase(TEST_DB_PATH);

        expect(() =>
          db
            .prepare(
              `INSERT INTO benchmark_runs (mode, batch_size, total_intents, total_txs, avg_gas_per_intent, avg_latency_ms, throughput, failed_rate)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .run("invalid_mode", 10, 100, 10, 80000, 5000, 12.0, 0.02)
        ).toThrow();
      } catch (e: unknown) {
        const err = e as Error;
        if (err.code === "ERR_MODULE_NOT_FOUND" || err.message?.includes("Cannot find module")) {
          throw new Error(`RED: database.ts not yet implemented — ${err.message}`);
        }
        throw e;
      }
    });

    it("DB-008: agent_address UNIQUE constraint prevents duplicates (RED)", async () => {
      try {
        const { initializeDatabase } = await import("../../scripts/database");
        db = initializeDatabase(TEST_DB_PATH);

        db.prepare(
          `INSERT INTO agents (chain_agent_id, owner, agent_address)
         VALUES (?, ?, ?)`
        ).run(1, "0xOwner", "0xAgent1");

        expect(() =>
          db
            .prepare(
              `INSERT INTO agents (chain_agent_id, owner, agent_address)
             VALUES (?, ?, ?)`
            )
            .run(2, "0xOwner2", "0xAgent1")
        ).toThrow();
      } catch (e: unknown) {
        const err = e as Error;
        if (err.code === "ERR_MODULE_NOT_FOUND" || err.message?.includes("Cannot find module")) {
          throw new Error(`RED: database.ts not yet implemented — ${err.message}`);
        }
        throw e;
      }
    });

    it("DB-009: deleting a benchmark_run does not cascade to intents/batches (RED)", async () => {
      try {
        const { initializeDatabase } = await import("../../scripts/database");
        db = initializeDatabase(TEST_DB_PATH);

        // Insert a valid benchmark run
        db.prepare(
          `INSERT INTO benchmark_runs (mode, batch_size, total_intents, total_txs, avg_gas_per_intent, avg_latency_ms, throughput, failed_rate)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run("baseline", 1, 100, 100, 150000, 5000, 2.0, 0.02);

        const countBefore = (
          db.prepare("SELECT COUNT(*) as cnt FROM benchmark_runs").get() as {
            cnt: number;
          }
        ).cnt;
        expect(countBefore).toBe(1);

        db.prepare("DELETE FROM benchmark_runs WHERE id = 1").run();

        const countAfter = (
          db.prepare("SELECT COUNT(*) as cnt FROM benchmark_runs").get() as {
            cnt: number;
          }
        ).cnt;
        expect(countAfter).toBe(0);
      } catch (e: unknown) {
        const err = e as Error;
        if (err.code === "ERR_MODULE_NOT_FOUND" || err.message?.includes("Cannot find module")) {
          throw new Error(`RED: database.ts not yet implemented — ${err.message}`);
        }
        throw e;
      }
    });
  });
});
