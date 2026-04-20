import { db, schema } from "../db";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { logger } from "../utils/logger";
import { createNotification } from "../services/notificationService";

export async function runAutoIncidentCheck(): Promise<void> {
  try {
    // 1. Find unlinked critical/high unresolved alerts
    const unlinkedAlerts = await db
      .select({
        id: schema.alerts.id,
        title: schema.alerts.title,
        severity: schema.alerts.severity,
        systemId: schema.alerts.systemId,
        systemName: schema.systems.name,
      })
      .from(schema.alerts)
      .leftJoin(schema.systems, eq(schema.alerts.systemId, schema.systems.id))
      .where(
        and(
          inArray(schema.alerts.severity, ["critica", "alta"]),
          eq(schema.alerts.resolved, false),
          isNull(schema.alerts.incidentId),
        ),
      );

    if (unlinkedAlerts.length === 0) return;

    // 2. Group by systemId (or by title prefix if systemId is null)
    const byGroup = new Map<string, typeof unlinkedAlerts>();
    for (const alert of unlinkedAlerts) {
      const key = alert.systemId ?? `title:${alert.title.slice(0, 40)}`;
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key)!.push(alert);
    }

    // Get all admin/tecnico users for notifications
    const staffUsers = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(
        and(
          eq(schema.users.active, true),
          inArray(schema.users.role, ["admin", "tecnico"]),
        ),
      );

    for (const [groupKey, alerts] of byGroup) {
      // Determine worst severity
      const severityOrder: Record<string, number> = { critica: 0, alta: 1, media: 2, baja: 3, info: 4 };
      const worstAlert = alerts.sort((a, b) => (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5))[0];
      const systemId = worstAlert.systemId ?? undefined;
      const systemName = worstAlert.systemName ?? "Sistema desconocido";

      // 3. Find existing open incident for this system
      let existingIncident: { id: string } | null = null;

      if (systemId) {
        const [found] = await db
          .select({ id: schema.incidents.id })
          .from(schema.incidents)
          .where(
            and(
              eq(schema.incidents.systemId, systemId),
              inArray(schema.incidents.status, ["abierta", "en_progreso"]),
            ),
          )
          .limit(1);
        existingIncident = found ?? null;
      }

      let incidentId: string;
      let isNew = false;

      if (existingIncident) {
        incidentId = existingIncident.id;
      } else {
        // 5. Create new incident
        const [newIncident] = await db
          .insert(schema.incidents)
          .values({
            title: `Alerta automática: ${systemName}`,
            severity: worstAlert.severity,
            status: "abierta",
            systemId,
            description: `Incidente creado automáticamente por ${alerts.length} alerta(s) sin resolver de severidad ${worstAlert.severity}.`,
          })
          .returning({ id: schema.incidents.id });

        incidentId = newIncident.id;
        isNew = true;
      }

      // 4/5. Link alerts to incident (idempotent)
      for (const alert of alerts) {
        await db
          .update(schema.alerts)
          .set({ incidentId })
          .where(eq(schema.alerts.id, alert.id));

        await db
          .insert(schema.incidentAlerts)
          .values({ incidentId, alertId: alert.id })
          .onConflictDoNothing();
      }

      // 6. Notify staff about new incidents only
      if (isNew) {
        logger.info({ incidentId, systemName, alertCount: alerts.length }, "Auto-incident created");

        for (const user of staffUsers) {
          await createNotification(user.id, {
            title: `Incidente automático: ${systemName}`,
            body: `Se creó un incidente automático con ${alerts.length} alerta(s) de severidad ${worstAlert.severity}.`,
            type: worstAlert.severity === "critica" ? "error" : "warning",
            link: `/incidents/${incidentId}`,
            entityType: "incident",
            entityId: incidentId,
          });
        }
      }
    }

    logger.debug({ groups: byGroup.size }, "Auto incident check complete");
  } catch (err: any) {
    logger.error({ err: err.message }, "runAutoIncidentCheck failed");
  }
}
