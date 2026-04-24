import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/middleware";
import { db, schema } from "../db";
import { eq, and, desc, like, sql, inArray } from "drizzle-orm";
import { recordAudit } from "../utils/audit";
import { NotFoundError, ForbiddenError } from "../utils/errors";
import { notifyNewCriticalIncident } from "../services/notificationService";

export async function incidentRoutes(app: FastifyInstance) {
  // List incidents
  app.get("/", { preHandler: requireAuth }, async (req) => {
    const q = z.object({
      status: z.string().optional(),
      severity: z.string().optional(),
      assignedTo: z.string().optional(),
      search: z.string().optional(),
      page: z.coerce.number().default(1),
      limit: z.coerce.number().max(100).default(20),
    }).parse(req.query);

    const conditions = [];
    if (q.status && q.status !== "all") {
      conditions.push(eq(schema.incidents.status, q.status as any));
    }
    if (q.severity) conditions.push(eq(schema.incidents.severity, q.severity as any));
    if (q.assignedTo) conditions.push(eq(schema.incidents.assignedTo, q.assignedTo));
    if (q.search) {
      conditions.push(
        sql`(${schema.incidents.title} ILIKE ${"%" + q.search + "%"} OR ${schema.incidents.description} ILIKE ${"%" + q.search + "%"})`,
      );
    }

    const offset = (q.page - 1) * q.limit;
    const whereClause = conditions.length ? and(...conditions) : undefined;

    const [incidents, totalResult] = await Promise.all([
      db
        .select({
          id: schema.incidents.id,
          title: schema.incidents.title,
          severity: schema.incidents.severity,
          status: schema.incidents.status,
          tags: schema.incidents.tags,
          createdAt: schema.incidents.createdAt,
          updatedAt: schema.incidents.updatedAt,
          resolvedAt: schema.incidents.resolvedAt,
          assignedUser: {
            id: schema.users.id,
            displayName: schema.users.displayName,
            avatar: schema.users.avatar,
          },
          system: {
            id: schema.systems.id,
            name: schema.systems.name,
            type: schema.systems.type,
          },
        })
        .from(schema.incidents)
        .leftJoin(schema.users, eq(schema.incidents.assignedTo, schema.users.id))
        .leftJoin(schema.systems, eq(schema.incidents.systemId, schema.systems.id))
        .where(whereClause)
        .orderBy(
          sql`CASE ${schema.incidents.severity}
            WHEN 'critica' THEN 1
            WHEN 'alta' THEN 2
            WHEN 'media' THEN 3
            WHEN 'baja' THEN 4
            ELSE 5 END`,
          desc(schema.incidents.createdAt),
        )
        .limit(q.limit)
        .offset(offset),

      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.incidents)
        .where(whereClause),
    ]);

    return {
      data: incidents,
      total: Number(totalResult[0]?.count ?? 0),
      page: q.page,
      limit: q.limit,
    };
  });

  // Get incident detail
  app.get("/:id", { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };

    const [incident] = await db
      .select()
      .from(schema.incidents)
      .where(eq(schema.incidents.id, id))
      .limit(1);

    if (!incident) throw new NotFoundError("Incidencia");

    const [checklist, comments, linkedAlerts, automationRuns, assignedUser, system] =
      await Promise.all([
        db
          .select()
          .from(schema.checklistItems)
          .where(eq(schema.checklistItems.incidentId, id))
          .orderBy(schema.checklistItems.order),

        db
          .select({
            id: schema.incidentComments.id,
            content: schema.incidentComments.content,
            isSystemMessage: schema.incidentComments.isSystemMessage,
            createdAt: schema.incidentComments.createdAt,
            author: {
              id: schema.users.id,
              displayName: schema.users.displayName,
              avatar: schema.users.avatar,
            },
          })
          .from(schema.incidentComments)
          .leftJoin(schema.users, eq(schema.incidentComments.authorId, schema.users.id))
          .where(eq(schema.incidentComments.incidentId, id))
          .orderBy(schema.incidentComments.createdAt),

        db
          .select({ alertId: schema.incidentAlerts.alertId })
          .from(schema.incidentAlerts)
          .where(eq(schema.incidentAlerts.incidentId, id)),

        db
          .select({
            id: schema.automationRuns.id,
            status: schema.automationRuns.status,
            createdAt: schema.automationRuns.createdAt,
            finishedAt: schema.automationRuns.finishedAt,
            action: { name: schema.automationActions.name, category: schema.automationActions.category },
            user: { displayName: schema.users.displayName },
          })
          .from(schema.automationRuns)
          .leftJoin(schema.automationActions, eq(schema.automationRuns.actionId, schema.automationActions.id))
          .leftJoin(schema.users, eq(schema.automationRuns.triggeredBy, schema.users.id))
          .where(eq(schema.automationRuns.incidentId, id))
          .orderBy(desc(schema.automationRuns.createdAt))
          .limit(10),

        incident.assignedTo
          ? db.select().from(schema.users).where(eq(schema.users.id, incident.assignedTo)).limit(1)
          : Promise.resolve([]),

        incident.systemId
          ? db.select().from(schema.systems).where(eq(schema.systems.id, incident.systemId)).limit(1)
          : Promise.resolve([]),
      ]);

    return {
      ...incident,
      checklist,
      comments,
      linkedAlertIds: linkedAlerts.map((a) => a.alertId),
      automationRuns,
      assignedUser: (assignedUser as any)[0] ?? null,
      system: (system as any)[0] ?? null,
    };
  });

  // Create incident
  app.post("/", { preHandler: requireAuth }, async (req, reply) => {
    const body = z.object({
      title: z.string().min(3),
      description: z.string().optional(),
      severity: z.enum(["critica", "alta", "media", "baja", "info"]),
      systemId: z.string().uuid().optional(),
      assignedTo: z.string().uuid().optional(),
      tags: z.array(z.string()).default([]),
      impact: z.string().optional(),
      checklist: z.array(z.string()).default([]),
    }).parse(req.body);

    const { checklist: checklistItems, ...incidentData } = body;

    const [incident] = await db
      .insert(schema.incidents)
      .values({ ...incidentData, createdBy: req.user.sub })
      .returning();

    if (checklistItems.length) {
      await db.insert(schema.checklistItems).values(
        checklistItems.map((text, order) => ({
          incidentId: incident.id,
          text,
          order,
        })),
      );
    }

    await db.insert(schema.incidentComments).values({
      incidentId: incident.id,
      authorId: req.user.sub,
      content: `Incidencia creada por ${req.user.displayName}`,
      isSystemMessage: true,
    });

    await recordAudit({
      userId: req.user.sub,
      action: "create",
      entityType: "incident",
      entityId: incident.id,
      entityName: incident.title,
      description: `${req.user.displayName} creó incidencia: ${incident.title}`,
      req,
    });

    if (["critica", "alta"].includes(incident.severity)) {
      const system = incident.systemId
        ? await db.select().from(schema.systems).where(eq(schema.systems.id, incident.systemId)).limit(1)
        : [];
      await notifyNewCriticalIncident({
        id: incident.id,
        title: incident.title,
        severity: incident.severity,
        systemName: (system as any)[0]?.name,
        assignedTo: req.user.displayName,
      });
    }

    return reply.status(201).send(incident);
  });

  // Update incident
  app.put("/:id", { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      title: z.string().min(3).optional(),
      description: z.string().optional(),
      severity: z.enum(["critica", "alta", "media", "baja", "info"]).optional(),
      status: z.enum(["abierta", "en_progreso", "pendiente", "resuelta", "cerrada"]).optional(),
      assignedTo: z.string().uuid().nullable().optional(),
      rootCause: z.string().optional(),
      resolution: z.string().optional(),
      impact: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }).parse(req.body);

    const [before] = await db.select().from(schema.incidents).where(eq(schema.incidents.id, id)).limit(1);
    if (!before) throw new NotFoundError("Incidencia");

    const updates: any = { ...body, updatedAt: new Date() };
    if (body.status === "resuelta" && !before.resolvedAt) updates.resolvedAt = new Date();
    if (body.status === "cerrada" && !before.closedAt) updates.closedAt = new Date();

    const [updated] = await db
      .update(schema.incidents)
      .set(updates)
      .where(eq(schema.incidents.id, id))
      .returning();

    if (body.status && body.status !== before.status) {
      await db.insert(schema.incidentComments).values({
        incidentId: id,
        authorId: req.user.sub,
        content: `Estado cambiado de "${before.status}" a "${body.status}" por ${req.user.displayName}`,
        isSystemMessage: true,
      });
    }

    await recordAudit({
      userId: req.user.sub,
      action: "update",
      entityType: "incident",
      entityId: id,
      entityName: before.title,
      description: `${req.user.displayName} actualizó incidencia: ${before.title}`,
      changes: { before, after: updates },
      req,
    });

    return updated;
  });

  // Close incident with RCA → auto-generate KB article
  app.post("/:id/close", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      rootCause: z.string().min(10),
      resolution: z.string().min(10),
      generateKbArticle: z.boolean().default(true),
    }).parse(req.body);

    const [incident] = await db.select().from(schema.incidents).where(eq(schema.incidents.id, id)).limit(1);
    if (!incident) throw new NotFoundError("Incidencia");

    const [closed] = await db
      .update(schema.incidents)
      .set({
        status: "cerrada",
        rootCause: body.rootCause,
        resolution: body.resolution,
        closedAt: new Date(),
        resolvedAt: incident.resolvedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.incidents.id, id))
      .returning();

    let kbArticle = null;
    if (body.generateKbArticle) {
      const [article] = await db
        .insert(schema.kbArticles)
        .values({
          title: `RCA: ${incident.title}`,
          content: `## Descripción\n${incident.description ?? "N/A"}\n\n## Causa Raíz\n${body.rootCause}\n\n## Resolución\n${body.resolution}\n\n## Impacto\n${incident.impact ?? "N/A"}`,
          summary: body.rootCause.slice(0, 200),
          tags: incident.tags,
          systemId: incident.systemId ?? null,
          sourceIncidentId: id,
          autoGenerated: true,
          createdBy: req.user.sub,
          updatedBy: req.user.sub,
        })
        .returning();

      await db.update(schema.incidents).set({ kbArticleId: article.id }).where(eq(schema.incidents.id, id));
      kbArticle = article;
    }

    await db.insert(schema.incidentComments).values({
      incidentId: id,
      authorId: req.user.sub,
      content: `Incidencia cerrada por ${req.user.displayName}. Causa raíz: ${body.rootCause.slice(0, 100)}...`,
      isSystemMessage: true,
    });

    await recordAudit({
      userId: req.user.sub,
      action: "close",
      entityType: "incident",
      entityId: id,
      entityName: incident.title,
      description: `${req.user.displayName} cerró incidencia: ${incident.title}`,
      req,
    });

    return reply.send({ incident: closed, kbArticle });
  });

  // Add comment
  app.post("/:id/comments", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { content } = z.object({ content: z.string().min(1) }).parse(req.body);

    const [comment] = await db
      .insert(schema.incidentComments)
      .values({ incidentId: id, authorId: req.user.sub, content })
      .returning();

    return reply.status(201).send(comment);
  });

  // Update checklist item
  app.patch("/:id/checklist/:itemId", { preHandler: requireAuth }, async (req) => {
    const { id, itemId } = req.params as { id: string; itemId: string };
    const { completed } = z.object({ completed: z.boolean() }).parse(req.body);

    const [item] = await db
      .update(schema.checklistItems)
      .set({
        completed,
        completedBy: completed ? req.user.sub : null,
        completedAt: completed ? new Date() : null,
      })
      .where(and(eq(schema.checklistItems.id, itemId), eq(schema.checklistItems.incidentId, id)))
      .returning();

    return item;
  });

  // Assign incident
  app.patch("/:id/assign", { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const { userId } = z.object({ userId: z.string().uuid() }).parse(req.body);

    const [before] = await db.select({ assignedTo: schema.incidents.assignedTo, title: schema.incidents.title })
      .from(schema.incidents).where(eq(schema.incidents.id, id)).limit(1);
    if (!before) throw new NotFoundError("Incidencia");

    const [updated] = await db
      .update(schema.incidents)
      .set({ assignedTo: userId, status: "en_progreso", updatedAt: new Date() })
      .where(eq(schema.incidents.id, id))
      .returning();

    const [assignedUser] = await db.select({ displayName: schema.users.displayName })
      .from(schema.users).where(eq(schema.users.id, userId)).limit(1);

    await db.insert(schema.incidentComments).values({
      incidentId: id,
      authorId: req.user.sub,
      content: `Asignada a ${assignedUser?.displayName ?? userId} por ${req.user.displayName}`,
      isSystemMessage: true,
    });

    await recordAudit({
      userId: req.user.sub,
      action: "assign",
      entityType: "incident",
      entityId: id,
      entityName: before.title,
      description: `${req.user.displayName} asignó incidencia a ${assignedUser?.displayName}`,
      req,
    });

    return updated;
  });
}
