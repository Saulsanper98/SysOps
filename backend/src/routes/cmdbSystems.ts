import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/middleware";
import { db, schema } from "../db";
import { eq, desc } from "drizzle-orm";
import { recordAudit } from "../utils/audit";
import { NotFoundError } from "../utils/errors";
import { wsManager } from "../services/wsManager";

/** Inventario CMDB (tabla systems) y mantenimiento. */
export async function cmdbSystemsRoutes(app: FastifyInstance) {
  app.get("/systems", { preHandler: requireAuth }, async () => {
    const rows = await db
      .select({
        id: schema.systems.id,
        name: schema.systems.name,
        type: schema.systems.type,
        category: schema.systems.category,
        environment: schema.systems.environment,
        connectorType: schema.systems.connectorType,
        connectorId: schema.systems.connectorId,
        maintenanceUntil: schema.systems.maintenanceUntil,
        maintenanceReason: schema.systems.maintenanceReason,
        active: schema.systems.active,
        tags: schema.systems.tags,
        updatedAt: schema.systems.updatedAt,
      })
      .from(schema.systems)
      .orderBy(desc(schema.systems.updatedAt));

    return rows;
  });

  app.patch("/systems/:id/maintenance", { preHandler: requireRole("admin", "tecnico") }, async (req) => {
    const { id } = req.params as { id: string };
    const body = z
      .object({
        maintenanceUntil: z.string().datetime().nullable(),
        maintenanceReason: z.string().max(500).nullable().optional(),
      })
      .parse(req.body);

    const [before] = await db.select().from(schema.systems).where(eq(schema.systems.id, id)).limit(1);
    if (!before) throw new NotFoundError("Sistema CMDB");

    const [updated] = await db
      .update(schema.systems)
      .set({
        maintenanceUntil: body.maintenanceUntil ? new Date(body.maintenanceUntil) : null,
        maintenanceReason: body.maintenanceReason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(schema.systems.id, id))
      .returning();

    await recordAudit({
      userId: req.user.sub,
      action: "update",
      entityType: "system",
      entityId: id,
      entityName: before.name,
      description: `Mantenimiento CMDB actualizado para ${before.name}`,
      req,
    });

    wsManager.broadcast({ type: "invalidate", scopes: ["dashboard", "alerts", "cmdb", "dashboard-systems"] });

    return updated;
  });
}
