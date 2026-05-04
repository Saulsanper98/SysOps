import { db, schema } from "../db";
import { and, desc, eq, inArray } from "drizzle-orm";

export interface IngestAlertInput {
  source: string;
  title: string;
  description?: string;
  severity: "critica" | "alta" | "media" | "baja" | "info";
  externalId?: string;
  systemId?: string | null;
  metadata?: Record<string, unknown>;
}

/** Inserta alerta en BD y devuelve id. Opcionalmente auto-vincula a incidencia abierta única por sistema. */
export async function ingestAlertRow(input: IngestAlertInput): Promise<{ id: string; autoLinkedIncidentId: string | null }> {
  if (input.externalId) {
    const [dup] = await db
      .select({ id: schema.alerts.id, incidentId: schema.alerts.incidentId })
      .from(schema.alerts)
      .where(and(eq(schema.alerts.externalId, input.externalId), eq(schema.alerts.source, input.source as any)))
      .limit(1);
    if (dup) {
      return { id: dup.id, autoLinkedIncidentId: dup.incidentId };
    }
  }

  const [row] = await db
    .insert(schema.alerts)
    .values({
      source: input.source as any,
      title: input.title,
      description: input.description ?? null,
      severity: input.severity,
      externalId: input.externalId ?? null,
      systemId: input.systemId ?? null,
      metadata: input.metadata ?? {},
      firedAt: new Date(),
    })
    .returning({ id: schema.alerts.id });

  let autoLinkedIncidentId: string | null = null;

  if (input.systemId) {
    const candidates = await db
      .select({ id: schema.incidents.id })
      .from(schema.incidents)
      .where(
        and(
          eq(schema.incidents.systemId, input.systemId),
          inArray(schema.incidents.status, ["abierta", "en_progreso", "pendiente"]),
        ),
      )
      .orderBy(desc(schema.incidents.createdAt))
      .limit(5);

    if (candidates.length === 1) {
      autoLinkedIncidentId = candidates[0].id;
      await db
        .update(schema.alerts)
        .set({ incidentId: autoLinkedIncidentId })
        .where(eq(schema.alerts.id, row.id));
      await db
        .insert(schema.incidentAlerts)
        .values({ incidentId: autoLinkedIncidentId, alertId: row.id })
        .onConflictDoNothing();
    } else if (candidates.length > 1) {
      const [cur] = await db.select().from(schema.alerts).where(eq(schema.alerts.id, row.id)).limit(1);
      const meta = { ...(cur?.metadata as Record<string, unknown> | undefined), suggestedIncidentIds: candidates.map((c) => c.id) };
      await db.update(schema.alerts).set({ metadata: meta }).where(eq(schema.alerts.id, row.id));
    }
  }

  return { id: row.id, autoLinkedIncidentId };
}

export async function findSuggestedIncidentsForAlert(alertId: string): Promise<{ id: string; title: string; status: string }[]> {
  const [alert] = await db.select().from(schema.alerts).where(eq(schema.alerts.id, alertId)).limit(1);
  if (!alert) return [];
  const meta = (alert.metadata ?? {}) as { suggestedIncidentIds?: string[] };
  if (meta.suggestedIncidentIds?.length) {
    return await db
      .select({ id: schema.incidents.id, title: schema.incidents.title, status: schema.incidents.status })
      .from(schema.incidents)
      .where(inArray(schema.incidents.id, meta.suggestedIncidentIds));
  }
  if (!alert.systemId) return [];
  return await db
    .select({ id: schema.incidents.id, title: schema.incidents.title, status: schema.incidents.status })
    .from(schema.incidents)
    .where(
      and(
        eq(schema.incidents.systemId, alert.systemId),
        inArray(schema.incidents.status, ["abierta", "en_progreso", "pendiente"]),
      ),
    )
    .orderBy(desc(schema.incidents.createdAt))
    .limit(10);
}
