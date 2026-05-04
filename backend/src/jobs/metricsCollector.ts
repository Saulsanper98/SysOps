import { db, schema } from "../db";
import { lt } from "drizzle-orm";
import { registry } from "../connectors/registry";
import { logger } from "../utils/logger";

export async function collectMetrics(): Promise<void> {
  try {
    const now = new Date();
    const snapshots: (typeof schema.metricSnapshots.$inferInsert)[] = [];

    // 1. Check all connectors — latency
    const results = await registry.checkAll();
    for (const r of results) {
      if (r.latencyMs !== undefined) {
        snapshots.push({
          source: r.type,
          metricType: "latency_ms",
          value: r.latencyMs,
        });
      }
    }

    // 2. Get all alerts — count by source
    const alerts = await registry.getAllAlerts();
    const bySource = new Map<string, number>();
    for (const a of alerts) {
      const src = a.metadata?.source as string ?? "unknown";
      bySource.set(src, (bySource.get(src) ?? 0) + 1);
    }
    for (const [source, count] of bySource) {
      snapshots.push({ source, metricType: "alerts_count", value: count });
    }
    // Total across all sources
    snapshots.push({ source: "all", metricType: "alerts_count", value: alerts.length });

    // 3. Get all systems — count OK
    const systems = await registry.getAllSystems();
    const okCount = systems.filter((s) => s.status === "ok").length;
    snapshots.push({ source: "all", metricType: "systems_ok", value: okCount });
    const okBySource = new Map<string, number>();
    for (const s of systems) {
      const src = (s.metadata?.source as string) ?? "unknown";
      if (s.status === "ok") okBySource.set(src, (okBySource.get(src) ?? 0) + 1);
    }
    for (const [source, n] of okBySource) {
      snapshots.push({ source, metricType: "systems_ok", value: n });
    }

    // 4. Insert all snapshots
    if (snapshots.length > 0) {
      await db.insert(schema.metricSnapshots).values(snapshots);
    }

    // 5. Purge old snapshots (>7 days)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    await db
      .delete(schema.metricSnapshots)
      .where(lt(schema.metricSnapshots.createdAt, sevenDaysAgo));

    logger.debug({ snapshots: snapshots.length }, "Metrics collected");
  } catch (err: any) {
    logger.error({ err: err.message }, "collectMetrics failed");
  }
}
