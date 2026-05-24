import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import { getDatabase } from "./database";

export function createApp(): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const db = getDatabase();

  app.get("/api/agents", (_req: Request, res: Response) => {
    try {
      const agents = db.prepare("SELECT * FROM agents").all();
      res.json(agents);
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/intents", (req: Request, res: Response) => {
    try {
      const status = (req.query.status as string) || "ALL";
      const limit = parseInt((req.query.limit as string) || "100", 10);
      let rows;
      if (status === "ALL") {
        rows = db.prepare("SELECT * FROM intents ORDER BY id DESC LIMIT ?").all(limit);
      } else {
        rows = db
          .prepare("SELECT * FROM intents WHERE status = ? ORDER BY id DESC LIMIT ?")
          .all(status, limit);
      }
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/batches", (_req: Request, res: Response) => {
    try {
      const batches = db.prepare("SELECT * FROM batches ORDER BY id DESC").all();
      res.json(batches);
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/benchmarks", (_req: Request, res: Response) => {
    try {
      const runs = db.prepare("SELECT * FROM benchmark_runs ORDER BY id DESC").all();
      res.json(runs);
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/metrics/comparison", (_req: Request, res: Response) => {
    try {
      const baseline = db
        .prepare(
          "SELECT * FROM benchmark_runs WHERE mode = 'baseline' ORDER BY id DESC LIMIT 1"
        )
        .get();
      const batching = db
        .prepare(
          "SELECT * FROM benchmark_runs WHERE mode = 'batching' ORDER BY id DESC LIMIT 1"
        )
        .get();
      res.json({ baseline, batching });
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });

  return app;
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error("Server error:", err.message);
  res.status(500).json({ error: "Internal server error" });
}

export function startServer(port?: number): ReturnType<Express["listen"]> {
  const app = createApp();
  const p = port || 3001;
  return app.listen(p, () => {
    console.log(`API server listening on port ${p}`);
  });
}

export function createQueryHandler(
  db: ReturnType<typeof getDatabase>,
  table: string
): (query: Record<string, string>) => unknown[] {
  return (query: Record<string, string>) => {
    const limit = parseInt(query.limit || "100", 10);
    return db.prepare(`SELECT * FROM ${table} LIMIT ?`).all(limit);
  };
}

export function getBatches(): unknown[] {
  const db = getDatabase();
  return db.prepare("SELECT * FROM batches ORDER BY id DESC").all();
}

export function getBenchmarks(): unknown[] {
  const db = getDatabase();
  return db.prepare("SELECT * FROM benchmark_runs ORDER BY id DESC").all();
}

export function getMetricsComparison(): {
  baseline: unknown;
  batching: unknown;
} {
  const db = getDatabase();
  const baseline = db
    .prepare("SELECT * FROM benchmark_runs WHERE mode = 'baseline' ORDER BY id DESC LIMIT 1")
    .get();
  const batching = db
    .prepare("SELECT * FROM benchmark_runs WHERE mode = 'batching' ORDER BY id DESC LIMIT 1")
    .get();
  return { baseline, batching };
}

export function measureResponseTime(): number {
  const start = Date.now();
  const db = getDatabase();
  db.prepare("SELECT COUNT(*) as cnt FROM agents").get();
  return Date.now() - start;
}
