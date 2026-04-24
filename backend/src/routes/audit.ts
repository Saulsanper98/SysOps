import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/middleware";
import { db, schema } from "../db";
import { eq, desc, gte, lte, sql, and } from "drizzle-orm";

export async function auditRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: requireAuth }, async (req) => {
    const q = z.object({
      entityType: z.string().optional(),
      entityId: z.string().optional(),
      userId: z.string().uuid().optional(),
      action: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      page: z.coerce.number().default(1),
      limit: z.coerce.number().max(100).default(30),
    }).parse(req.query);

    const conditions = [];
    if (q.entityType) conditions.push(eq(schema.auditEvents.entityType, q.entityType));
    if (q.entityId) conditions.push(eq(schema.auditEvents.entityId, q.entityId));
    if (q.userId) conditions.push(eq(schema.auditEvents.userId, q.userId));
    if (q.action) conditions.push(eq(schema.auditEvents.action, q.action as any));
    if (q.from) conditions.push(gte(schema.auditEvents.createdAt, new Date(q.from)));
    if (q.to) conditions.push(lte(schema.auditEvents.createdAt, new Date(q.to)));

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const [events, totalResult] = await Promise.all([
      db
        .select({
          id: schema.auditEvents.id,
          action: schema.auditEvents.action,
          entityType: schema.auditEvents.entityType,
          entityId: schema.auditEvents.entityId,
          entityName: schema.auditEvents.entityName,
          description: schema.auditEvents.description,
          changes: schema.auditEvents.changes,
          ipAddress: schema.auditEvents.ipAddress,
          createdAt: schema.auditEvents.createdAt,
          user: {
            id: schema.users.id,
            displayName: schema.users.displayName,
            username: schema.users.username,
            avatar: schema.users.avatar,
          },
        })
        .from(schema.auditEvents)
        .leftJoin(schema.users, eq(schema.auditEvents.userId, schema.users.id))
        .where(whereClause)
        .orderBy(desc(schema.auditEvents.createdAt))
        .limit(q.limit)
        .offset((q.page - 1) * q.limit),

      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.auditEvents)
        .where(whereClause),
    ]);

    return {
      data: events,
      total: Number(totalResult[0]?.count ?? 0),
      page: q.page,
      limit: q.limit,
    };
  });

  // Export audit events
  app.get("/export", { preHandler: requireAuth }, async (req, reply) => {
    const q = z.object({
      format: z.enum(["csv", "json"]).default("csv"),
      entityType: z.string().optional(),
      action: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    }).parse(req.query);

    const conditions = [];
    if (q.entityType) conditions.push(eq(schema.auditEvents.entityType, q.entityType));
    if (q.action) conditions.push(eq(schema.auditEvents.action, q.action as any));
    if (q.from) conditions.push(gte(schema.auditEvents.createdAt, new Date(q.from)));
    if (q.to) conditions.push(lte(schema.auditEvents.createdAt, new Date(q.to)));
    const whereClause = conditions.length ? and(...conditions) : undefined;

    const events = await db
      .select({
        id: schema.auditEvents.id,
        action: schema.auditEvents.action,
        entityType: schema.auditEvents.entityType,
        entityId: schema.auditEvents.entityId,
        entityName: schema.auditEvents.entityName,
        description: schema.auditEvents.description,
        ipAddress: schema.auditEvents.ipAddress,
        createdAt: schema.auditEvents.createdAt,
        userDisplayName: schema.users.displayName,
        userUsername: schema.users.username,
      })
      .from(schema.auditEvents)
      .leftJoin(schema.users, eq(schema.auditEvents.userId, schema.users.id))
      .where(whereClause)
      .orderBy(desc(schema.auditEvents.createdAt))
      .limit(5000);

    const filename = `audit-${new Date().toISOString().slice(0, 10)}`;

    if (q.format === "json") {
      reply.header("Content-Disposition", `attachment; filename="${filename}.json"`);
      reply.header("Content-Type", "application/json");
      return reply.send(events);
    }

    const csvHeader = "id,action,entityType,entityId,entityName,description,user,ipAddress,createdAt";
    const csvRows = events.map((e) =>
      [e.id, e.action, e.entityType, e.entityId ?? "", e.entityName ?? "",
       `"${(e.description ?? "").replace(/"/g, '""')}"`,
       e.userDisplayName ?? "", e.ipAddress ?? "", e.createdAt?.toISOString() ?? ""]
        .join(","),
    );
    const csv = [csvHeader, ...csvRows].join("\n");
    reply.header("Content-Disposition", `attachment; filename="${filename}.csv"`);
    reply.header("Content-Type", "text/csv");
    return reply.send(csv);
  });

  // Stats for a specific entity
  app.get("/entity/:type/:id", { preHandler: requireAuth }, async (req) => {
    const { type, id } = req.params as { type: string; id: string };

    const events = await db
      .select({
        id: schema.auditEvents.id,
        action: schema.auditEvents.action,
        description: schema.auditEvents.description,
        createdAt: schema.auditEvents.createdAt,
        user: {
          displayName: schema.users.displayName,
          avatar: schema.users.avatar,
        },
      })
      .from(schema.auditEvents)
      .leftJoin(schema.users, eq(schema.auditEvents.userId, schema.users.id))
      .where(and(eq(schema.auditEvents.entityType, type), eq(schema.auditEvents.entityId, id)))
      .orderBy(desc(schema.auditEvents.createdAt))
      .limit(50);

    return events;
  });
}
