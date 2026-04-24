import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/middleware";
import { db, schema } from "../db";
import { eq, desc, sql } from "drizzle-orm";
import { recordAudit } from "../utils/audit";
import { NotFoundError, ForbiddenError } from "../utils/errors";
import { automationQueue } from "../jobs/queue";

export async function automationRoutes(app: FastifyInstance) {
  // List available actions (catalog)
  app.get("/actions", { preHandler: requireAuth }, async (req) => {
    const actions = await db
      .select()
      .from(schema.automationActions)
      .where(eq(schema.automationActions.active, true))
      .orderBy(schema.automationActions.category, schema.automationActions.name);

    // Filter by user role
    const userRole = req.user.role;
    const roleOrder = { readonly: 0, tecnico: 1, admin: 2 };
    return actions.filter(
      (a) => roleOrder[userRole as keyof typeof roleOrder] >= roleOrder[a.requiredRole as keyof typeof roleOrder],
    );
  });

  // Execute an action
  app.post("/actions/:id/run", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      parameters: z.record(z.unknown()).default({}),
      incidentId: z.string().uuid().optional(),
      systemId: z.string().uuid().optional(),
    }).parse(req.body);

    const [action] = await db
      .select()
      .from(schema.automationActions)
      .where(eq(schema.automationActions.id, id))
      .limit(1);

    if (!action) throw new NotFoundError("Acción");
    if (!action.active) throw new ForbiddenError("Esta acción está desactivada");

    const roleOrder = { readonly: 0, tecnico: 1, admin: 2 };
    if ((roleOrder[req.user.role as keyof typeof roleOrder] ?? -1) < (roleOrder[action.requiredRole as keyof typeof roleOrder] ?? 99)) {
      throw new ForbiddenError(`Esta acción requiere rol: ${action.requiredRole}`);
    }

    const [run] = await db
      .insert(schema.automationRuns)
      .values({
        actionId: action.id,
        triggeredBy: req.user.sub,
        incidentId: body.incidentId ?? null,
        systemId: body.systemId ?? null,
        parameters: body.parameters,
        status: "pendiente",
      })
      .returning();

    const job = await automationQueue.add(
      action.jobName,
      {
        runId: run.id,
        actionId: action.id,
        jobName: action.jobName,
        parameters: body.parameters,
        triggeredBy: req.user.sub,
        systemId: body.systemId,
      },
      { attempts: 2, backoff: { type: "fixed", delay: 2000 } },
    );

    await db
      .update(schema.automationRuns)
      .set({ jobId: job.id ?? null })
      .where(eq(schema.automationRuns.id, run.id));

    await recordAudit({
      userId: req.user.sub,
      action: "execute",
      entityType: "automation_run",
      entityId: run.id,
      entityName: action.name,
      description: `${req.user.displayName} ejecutó: ${action.name}`,
      metadata: { parameters: body.parameters, actionId: action.id },
      req,
    });

    return reply.status(202).send({ runId: run.id, jobId: job.id, status: "pendiente" });
  });

  // Get run status
  app.get("/runs/:runId", { preHandler: requireAuth }, async (req) => {
    const { runId } = req.params as { runId: string };

    const [run] = await db
      .select({
        id: schema.automationRuns.id,
        status: schema.automationRuns.status,
        output: schema.automationRuns.output,
        error: schema.automationRuns.error,
        parameters: schema.automationRuns.parameters,
        startedAt: schema.automationRuns.startedAt,
        finishedAt: schema.automationRuns.finishedAt,
        createdAt: schema.automationRuns.createdAt,
        action: {
          id: schema.automationActions.id,
          name: schema.automationActions.name,
          category: schema.automationActions.category,
        },
        triggeredBy: {
          id: schema.users.id,
          displayName: schema.users.displayName,
        },
      })
      .from(schema.automationRuns)
      .leftJoin(schema.automationActions, eq(schema.automationRuns.actionId, schema.automationActions.id))
      .leftJoin(schema.users, eq(schema.automationRuns.triggeredBy, schema.users.id))
      .where(eq(schema.automationRuns.id, runId))
      .limit(1);

    if (!run) throw new NotFoundError("Ejecución");
    return run;
  });

  // List runs (history)
  app.get("/runs", { preHandler: requireAuth }, async (req) => {
    const q = z.object({
      page: z.coerce.number().default(1),
      limit: z.coerce.number().max(50).default(20),
      actionId: z.string().uuid().optional(),
      status: z.string().optional(),
    }).parse(req.query);

    const conditions = [];
    if (q.actionId) conditions.push(eq(schema.automationRuns.actionId, q.actionId));
    if (q.status) conditions.push(eq(schema.automationRuns.status, q.status as any));

    const whereClause = conditions.length ? conditions.reduce((a, b) => sql`${a} AND ${b}`) : undefined;

    const runs = await db
      .select({
        id: schema.automationRuns.id,
        status: schema.automationRuns.status,
        parameters: schema.automationRuns.parameters,
        startedAt: schema.automationRuns.startedAt,
        finishedAt: schema.automationRuns.finishedAt,
        createdAt: schema.automationRuns.createdAt,
        action: { name: schema.automationActions.name, category: schema.automationActions.category },
        triggeredBy: { displayName: schema.users.displayName },
        system: { name: schema.systems.name },
      })
      .from(schema.automationRuns)
      .leftJoin(schema.automationActions, eq(schema.automationRuns.actionId, schema.automationActions.id))
      .leftJoin(schema.users, eq(schema.automationRuns.triggeredBy, schema.users.id))
      .leftJoin(schema.systems, eq(schema.automationRuns.systemId, schema.systems.id))
      .where(whereClause)
      .orderBy(desc(schema.automationRuns.createdAt))
      .limit(q.limit)
      .offset((q.page - 1) * q.limit);

    return runs;
  });

  // Admin: create/update action
  app.post("/actions", { preHandler: requireRole("admin") }, async (req, reply) => {
    const body = z.object({
      name: z.string().min(2),
      description: z.string().optional(),
      category: z.string(),
      icon: z.string().optional(),
      targetType: z.string().default("all"),
      connectorType: z.string().optional(),
      parameters: z.array(z.unknown()).default([]),
      jobName: z.string(),
      requiredRole: z.enum(["admin", "tecnico", "readonly"]).default("tecnico"),
      dangerous: z.boolean().default(false),
    }).parse(req.body);

    const [action] = await db.insert(schema.automationActions).values(body as any).returning();

    await recordAudit({
      userId: req.user.sub,
      action: "create",
      entityType: "automation_action",
      entityId: action.id,
      entityName: action.name,
      description: `Admin ${req.user.displayName} creó acción: ${action.name}`,
      req,
    });

    return reply.status(201).send(action);
  });
}
