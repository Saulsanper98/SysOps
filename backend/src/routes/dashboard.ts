import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth/middleware";
import { registry } from "../connectors/registry";
import { db, schema } from "../db";
import { desc, count, sql, lt, notInArray, isNull, or, and } from "drizzle-orm";
import { config } from "../config";

export async function dashboardRoutes(app: FastifyInstance) {
  // Main dashboard summary
  app.get("/summary", { preHandler: requireAuth }, async () => {
    const now = new Date();
    const [
      alertData,
      systemData,
      connectorData,
      openIncidents,
      todayIncidents,
      slaBreaches,
    ] = await Promise.all([
      registry.getAllAlerts(),
      registry.getAllSystems(),
      registry.checkAll(),
      db
        .select({ count: count() })
        .from(schema.incidents)
        .where(
          sql`${schema.incidents.status} IN ('abierta', 'en_progreso')`,
        )
        .then((r) => r[0]?.count ?? 0),
      db
        .select({ count: count() })
        .from(schema.incidents)
        .where(
          sql`DATE(${schema.incidents.createdAt}) = CURRENT_DATE`,
        )
        .then((r) => r[0]?.count ?? 0),
      db
        .select({ count: count() })
        .from(schema.incidents)
        .where(
          and(
            notInArray(schema.incidents.status, ["resuelta", "cerrada"]),
            or(
              and(isNull(schema.incidents.firstResponseAt), lt(schema.incidents.slaResponseDueAt, now)),
              lt(schema.incidents.slaResolutionDueAt, now),
            )!,
          ),
        )
        .then((r) => r[0]?.count ?? 0),
    ]);

    const activeAlerts = alertData.filter((a) => !(a.metadata?.ack === true));
    const criticalAlerts = activeAlerts.filter((a) => a.severity === "critica");
    const highAlerts = activeAlerts.filter((a) => a.severity === "alta");

    const systemsOk = systemData.filter((s) => s.status === "ok").length;
    const systemsDegraded = systemData.filter((s) => s.status === "degradado").length;
    const systemsCritical = systemData.filter((s) => s.status === "critico").length;
    const connectorsHealthy = connectorData.filter((c) => c.healthy).length;

    return {
      alerts: {
        total: activeAlerts.length,
        critical: criticalAlerts.length,
        high: highAlerts.length,
        topAlerts: activeAlerts
          .sort((a, b) => {
            const order = { critica: 0, alta: 1, media: 2, baja: 3, info: 4 };
            return (order[a.severity] ?? 5) - (order[b.severity] ?? 5);
          })
          .slice(0, 8),
      },
      systems: {
        total: systemData.length,
        ok: systemsOk,
        degraded: systemsDegraded,
        critical: systemsCritical,
        healthPercent: systemData.length
          ? Math.round((systemsOk / systemData.length) * 100)
          : 100,
      },
      incidents: {
        open: Number(openIncidents),
        today: Number(todayIncidents),
        slaBreaches: Number(slaBreaches),
      },
      connectors: {
        total: connectorData.length,
        healthy: connectorsHealthy,
        list: connectorData,
      },
      demoMode: config.DEMO_MODE,
    };
  });

  // System status list
  app.get("/systems", { preHandler: requireAuth }, async (req) => {
    const { filter } = req.query as { filter?: string };
    let systems = await registry.getAllSystems();
    if (filter && filter !== "all") {
      systems = systems.filter((s) => s.status === filter || s.metadata?.source === filter);
    }
    return systems;
  });

  // Top alerts for daily focus
  app.get("/daily-focus", { preHandler: requireAuth }, async () => {
    const [alerts, recentIncidents] = await Promise.all([
      registry.getAllAlerts(),
      db
        .select({
          id: schema.incidents.id,
          title: schema.incidents.title,
          severity: schema.incidents.severity,
          status: schema.incidents.status,
          createdAt: schema.incidents.createdAt,
        })
        .from(schema.incidents)
        .where(sql`${schema.incidents.status} IN ('abierta', 'en_progreso')`)
        .orderBy(desc(schema.incidents.createdAt))
        .limit(5),
    ]);

    const topAlerts = alerts
      .filter((a) => !(a.metadata?.ack === true))
      .filter((a) => a.severity === "critica" || a.severity === "alta")
      .slice(0, 5);

    return {
      focusItems: [
        ...topAlerts.map((a) => ({
          type: "alert",
          id: a.externalId,
          title: a.title,
          severity: a.severity,
          system: a.systemName,
          time: a.firedAt,
        })),
        ...recentIncidents.map((i) => ({
          type: "incident",
          id: i.id,
          title: i.title,
          severity: i.severity,
          status: i.status,
          time: i.createdAt,
        })),
      ].slice(0, 10),
    };
  });

  // Connector health status
  app.get("/connectors", { preHandler: requireAuth }, async () => {
    return registry.checkAll();
  });
}
