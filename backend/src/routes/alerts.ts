import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db, schema } from "../db";
import { eq, and, or, ilike, inArray, isNull, isNotNull } from "drizzle-orm";
import { requireAuth } from "../auth/middleware";
import { NotFoundError, ForbiddenError } from "../utils/errors";
import { recordAudit } from "../utils/audit";

export async function alertRoutes(app: FastifyInstance) {
  // GET / — list alerts with filters
  app.get("/", { preHandler: requireAuth }, async (req) => {
    const query = z.object({
      source: z.string().optional(),
      severity: z.string().optional(),
      acknowledged: z.string().optional(),
      resolved: z.string().optional(),
      search: z.string().optional(),
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(100).default(20),
    }).parse(req.query);

    const conditions = [];

    if (query.source) {
      conditions.push(eq(schema.alerts.source, query.source as any));
    }
    if (query.severity) {
      conditions.push(eq(schema.alerts.severity, query.severity as any));
    }
    if (query.acknowledged !== undefined) {
      conditions.push(eq(schema.alerts.acknowledged, query.acknowledged === "true"));
    }
    if (query.resolved !== undefined) {
      conditions.push(eq(schema.alerts.resolved, query.resolved === "true"));
    }
    if (query.search) {
      conditions.push(ilike(schema.alerts.title, `%${query.search}%`));
    }

    const offset = (query.page - 1) * query.limit;

    const alerts = await db
      .select({
        id: schema.alerts.id,
        externalId: schema.alerts.externalId,
        source: schema.alerts.source,
        systemId: schema.alerts.systemId,
        title: schema.alerts.title,
        description: schema.alerts.description,
        severity: schema.alerts.severity,
        tags: schema.alerts.tags,
        acknowledged: schema.alerts.acknowledged,
        acknowledgedBy: schema.alerts.acknowledgedBy,
        acknowledgedAt: schema.alerts.acknowledgedAt,
        resolved: schema.alerts.resolved,
        resolvedAt: schema.alerts.resolvedAt,
        incidentId: schema.alerts.incidentId,
        firedAt: schema.alerts.firedAt,
        createdAt: schema.alerts.createdAt,
        systemName: schema.systems.name,
      })
      .from(schema.alerts)
      .leftJoin(schema.systems, eq(schema.alerts.systemId, schema.systems.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(schema.alerts.firedAt)
      .limit(query.limit)
      .offset(offset);

    return alerts;
  });

  // GET /:id — detail
  app.get("/:id", { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };

    const [alert] = await db
      .select({
        id: schema.alerts.id,
        externalId: schema.alerts.externalId,
        source: schema.alerts.source,
        systemId: schema.alerts.systemId,
        title: schema.alerts.title,
        description: schema.alerts.description,
        severity: schema.alerts.severity,
        tags: schema.alerts.tags,
        acknowledged: schema.alerts.acknowledged,
        acknowledgedBy: schema.alerts.acknowledgedBy,
        acknowledgedAt: schema.alerts.acknowledgedAt,
        resolved: schema.alerts.resolved,
        resolvedAt: schema.alerts.resolvedAt,
        incidentId: schema.alerts.incidentId,
        metadata: schema.alerts.metadata,
        firedAt: schema.alerts.firedAt,
        createdAt: schema.alerts.createdAt,
        systemName: schema.systems.name,
        systemType: schema.systems.type,
      })
      .from(schema.alerts)
      .leftJoin(schema.systems, eq(schema.alerts.systemId, schema.systems.id))
      .where(eq(schema.alerts.id, id))
      .limit(1);

    if (!alert) throw new NotFoundError("Alerta");
    return alert;
  });

  // PATCH /:id/acknowledge
  app.patch("/:id/acknowledge", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };

    const [alert] = await db
      .select()
      .from(schema.alerts)
      .where(eq(schema.alerts.id, id))
      .limit(1);

    if (!alert) throw new NotFoundError("Alerta");

    await db
      .update(schema.alerts)
      .set({
        acknowledged: true,
        acknowledgedBy: req.user.sub,
        acknowledgedAt: new Date(),
      })
      .where(eq(schema.alerts.id, id));

    await recordAudit({
      userId: req.user.sub,
      action: "update",
      entityType: "alert",
      entityId: id,
      entityName: alert.title,
      description: `${req.user.username} reconoció la alerta: ${alert.title}`,
      req,
    });

    return reply.send({ ok: true });
  });

  // PATCH /:id/resolve
  app.patch("/:id/resolve", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };

    const [alert] = await db
      .select()
      .from(schema.alerts)
      .where(eq(schema.alerts.id, id))
      .limit(1);

    if (!alert) throw new NotFoundError("Alerta");

    await db
      .update(schema.alerts)
      .set({ resolved: true, resolvedAt: new Date() })
      .where(eq(schema.alerts.id, id));

    await recordAudit({
      userId: req.user.sub,
      action: "resolve",
      entityType: "alert",
      entityId: id,
      entityName: alert.title,
      description: `${req.user.username} resolvió la alerta: ${alert.title}`,
      req,
    });

    return reply.send({ ok: true });
  });

  // POST /:id/link-incident
  app.post("/:id/link-incident", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { incidentId } = z.object({ incidentId: z.string().uuid() }).parse(req.body);

    const [alert] = await db
      .select()
      .from(schema.alerts)
      .where(eq(schema.alerts.id, id))
      .limit(1);

    if (!alert) throw new NotFoundError("Alerta");

    const [incident] = await db
      .select()
      .from(schema.incidents)
      .where(eq(schema.incidents.id, incidentId))
      .limit(1);

    if (!incident) throw new NotFoundError("Incidente");

    await db
      .update(schema.alerts)
      .set({ incidentId })
      .where(eq(schema.alerts.id, id));

    await db
      .insert(schema.incidentAlerts)
      .values({ incidentId, alertId: id })
      .onConflictDoNothing();

    return reply.send({ ok: true });
  });

  // DELETE /:id/link-incident
  app.delete("/:id/link-incident", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };

    const [alert] = await db
      .select()
      .from(schema.alerts)
      .where(eq(schema.alerts.id, id))
      .limit(1);

    if (!alert) throw new NotFoundError("Alerta");

    const incidentId = alert.incidentId;

    await db
      .update(schema.alerts)
      .set({ incidentId: null })
      .where(eq(schema.alerts.id, id));

    if (incidentId) {
      await db
        .delete(schema.incidentAlerts)
        .where(
          and(
            eq(schema.incidentAlerts.incidentId, incidentId),
            eq(schema.incidentAlerts.alertId, id),
          ),
        );
    }

    return reply.send({ ok: true });
  });
}
