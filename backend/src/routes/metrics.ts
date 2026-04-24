import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db, schema } from "../db";
import { and, eq, gte, lte } from "drizzle-orm";
import { requireAuth } from "../auth/middleware";
import { ValidationError } from "../utils/errors";

// Map granularity string to bucket size in milliseconds
const GRANULARITY_MS: Record<string, number> = {
  "5m":  5  * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  "1h":  60 * 60 * 1000,
  "6h":  6  * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "1d":  24 * 60 * 60 * 1000,
  "1w":  7  * 24 * 60 * 60 * 1000,
};

function bucketTimestamp(ts: Date, bucketMs: number): string {
  const bucketed = new Date(Math.floor(ts.getTime() / bucketMs) * bucketMs);
  return bucketed.toISOString();
}

export async function metricsRoutes(app: FastifyInstance) {
  // GET /history — metric history with aggregation
  app.get("/history", { preHandler: requireAuth }, async (req) => {
    const query = z.object({
      source: z.string().optional(),
      type: z.enum(["alerts_count", "systems_ok", "latency_ms", "incidents_open"]),
      from: z.string().optional(),
      to: z.string().optional(),
      granularity: z.string().default("1h"),
    }).parse(req.query);

    const now = new Date();
    const fromDate = query.from ? new Date(query.from) : new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const toDate = query.to ? new Date(query.to) : now;

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new ValidationError("Parámetros de fecha inválidos");
    }

    const bucketMs = GRANULARITY_MS[query.granularity] ?? GRANULARITY_MS["1h"];

    const conditions = [
      eq(schema.metricSnapshots.metricType, query.type),
      gte(schema.metricSnapshots.createdAt, fromDate),
      lte(schema.metricSnapshots.createdAt, toDate),
    ];

    if (query.source) {
      conditions.push(eq(schema.metricSnapshots.source, query.source));
    }

    // Fetch raw rows — bucket aggregation done in JS (avoids date_trunc parameterization)
    const rawRows = await db
      .select({ value: schema.metricSnapshots.value, createdAt: schema.metricSnapshots.createdAt })
      .from(schema.metricSnapshots)
      .where(and(...conditions));

    // Bucket by timestamp
    const buckets = new Map<string, number[]>();
    for (const row of rawRows) {
      const key = bucketTimestamp(row.createdAt, bucketMs);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(row.value);
    }

    const data = Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([timestamp, vals]) => ({
        timestamp,
        value: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
      }));

    const values = rawRows.map((r) => r.value);
    const stats = values.length > 0
      ? {
          min: Math.min(...values),
          max: Math.max(...values),
          avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
          latest: values[values.length - 1],
        }
      : { min: 0, max: 0, avg: 0, latest: 0 };

    return {
      source: query.source ?? "all",
      metricType: query.type,
      data,
      stats,
    };
  });
}
