import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db, schema } from "../db";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { requireAuth } from "../auth/middleware";
import { ValidationError } from "../utils/errors";

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

    // Map granularity to valid date_trunc unit
    const granularityMap: Record<string, string> = {
      "5m": "minute",
      "15m": "minute",
      "30m": "minute",
      "1h": "hour",
      "6h": "hour",
      "12h": "hour",
      "1d": "day",
      "1w": "week",
    };
    const truncUnit = granularityMap[query.granularity] ?? "hour";

    const conditions = [
      eq(schema.metricSnapshots.metricType, query.type),
      gte(schema.metricSnapshots.createdAt, fromDate),
      lte(schema.metricSnapshots.createdAt, toDate),
    ];

    if (query.source) {
      conditions.push(eq(schema.metricSnapshots.source, query.source));
    }

    const rows = await db
      .select({
        timestamp: sql<string>`date_trunc(${truncUnit}, ${schema.metricSnapshots.createdAt})`,
        value: sql<number>`ROUND(AVG(${schema.metricSnapshots.value}))`,
      })
      .from(schema.metricSnapshots)
      .where(and(...conditions))
      .groupBy(sql`date_trunc(${truncUnit}, ${schema.metricSnapshots.createdAt})`)
      .orderBy(sql`date_trunc(${truncUnit}, ${schema.metricSnapshots.createdAt})`);

    // Stats from raw data
    const rawRows = await db
      .select({ value: schema.metricSnapshots.value })
      .from(schema.metricSnapshots)
      .where(and(...conditions));

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
      data: rows.map((r) => ({ timestamp: r.timestamp, value: r.value })),
      stats,
    };
  });
}
