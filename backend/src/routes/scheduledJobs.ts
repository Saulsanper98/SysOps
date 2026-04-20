import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db, schema } from "../db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../auth/middleware";
import { NotFoundError, ValidationError } from "../utils/errors";
import { recordAudit } from "../utils/audit";
import cron from "node-cron";

export async function scheduledJobRoutes(app: FastifyInstance) {
  // GET / — list all jobs
  app.get("/", { preHandler: requireAuth }, async () => {
    const jobs = await db
      .select({
        id: schema.scheduledJobs.id,
        name: schema.scheduledJobs.name,
        cronExpression: schema.scheduledJobs.cronExpression,
        parameters: schema.scheduledJobs.parameters,
        enabled: schema.scheduledJobs.enabled,
        lastRun: schema.scheduledJobs.lastRun,
        lastRunStatus: schema.scheduledJobs.lastRunStatus,
        nextRun: schema.scheduledJobs.nextRun,
        createdAt: schema.scheduledJobs.createdAt,
        actionId: schema.scheduledJobs.actionId,
        actionName: schema.automationActions.name,
        actionJobName: schema.automationActions.jobName,
      })
      .from(schema.scheduledJobs)
      .leftJoin(schema.automationActions, eq(schema.scheduledJobs.actionId, schema.automationActions.id))
      .orderBy(schema.scheduledJobs.name);

    return jobs;
  });

  // POST / — create job (admin only)
  app.post("/", { preHandler: requireRole("admin") }, async (req, reply) => {
    const body = z.object({
      actionId: z.string().uuid(),
      name: z.string().min(1),
      cronExpression: z.string().min(1),
      parameters: z.record(z.unknown()).default({}),
      enabled: z.boolean().default(true),
      runAsUserId: z.string().uuid().optional(),
    }).parse(req.body);

    if (!cron.validate(body.cronExpression)) {
      throw new ValidationError(`Expresión cron inválida: "${body.cronExpression}"`);
    }

    // Verify action exists
    const [action] = await db
      .select()
      .from(schema.automationActions)
      .where(eq(schema.automationActions.id, body.actionId))
      .limit(1);
    if (!action) throw new NotFoundError("Acción de automatización");

    const [job] = await db
      .insert(schema.scheduledJobs)
      .values({
        ...body,
        createdBy: req.user.sub,
      })
      .returning();

    // Sync with runner
    const { scheduledJobsRunner } = await import("../jobs/scheduledJobsRunner");
    if (job.enabled) scheduledJobsRunner.schedule(job);

    await recordAudit({
      userId: req.user.sub,
      action: "create",
      entityType: "scheduled_job",
      entityId: job.id,
      entityName: job.name,
      description: `${req.user.username} creó job programado: ${job.name}`,
      req,
    });

    return reply.status(201).send(job);
  });

  // PUT /:id — update job (admin only)
  app.put("/:id", { preHandler: requireRole("admin") }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      name: z.string().min(1).optional(),
      cronExpression: z.string().min(1).optional(),
      parameters: z.record(z.unknown()).optional(),
      enabled: z.boolean().optional(),
      runAsUserId: z.string().uuid().optional(),
    }).parse(req.body);

    const [existing] = await db
      .select()
      .from(schema.scheduledJobs)
      .where(eq(schema.scheduledJobs.id, id))
      .limit(1);
    if (!existing) throw new NotFoundError("Job programado");

    if (body.cronExpression && !cron.validate(body.cronExpression)) {
      throw new ValidationError(`Expresión cron inválida: "${body.cronExpression}"`);
    }

    const [updated] = await db
      .update(schema.scheduledJobs)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(schema.scheduledJobs.id, id))
      .returning();

    const { scheduledJobsRunner } = await import("../jobs/scheduledJobsRunner");
    scheduledJobsRunner.reschedule(updated);

    return reply.send(updated);
  });

  // PATCH /:id/toggle — enable/disable (admin only)
  app.patch("/:id/toggle", { preHandler: requireRole("admin") }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);

    const [existing] = await db
      .select()
      .from(schema.scheduledJobs)
      .where(eq(schema.scheduledJobs.id, id))
      .limit(1);
    if (!existing) throw new NotFoundError("Job programado");

    const [updated] = await db
      .update(schema.scheduledJobs)
      .set({ enabled, updatedAt: new Date() })
      .where(eq(schema.scheduledJobs.id, id))
      .returning();

    const { scheduledJobsRunner } = await import("../jobs/scheduledJobsRunner");
    if (enabled) {
      scheduledJobsRunner.schedule(updated);
    } else {
      scheduledJobsRunner.unschedule(id);
    }

    return reply.send({ ok: true, enabled });
  });

  // DELETE /:id — delete job (admin only)
  app.delete("/:id", { preHandler: requireRole("admin") }, async (req, reply) => {
    const { id } = req.params as { id: string };

    const [existing] = await db
      .select()
      .from(schema.scheduledJobs)
      .where(eq(schema.scheduledJobs.id, id))
      .limit(1);
    if (!existing) throw new NotFoundError("Job programado");

    const { scheduledJobsRunner } = await import("../jobs/scheduledJobsRunner");
    scheduledJobsRunner.unschedule(id);

    await db.delete(schema.scheduledJobs).where(eq(schema.scheduledJobs.id, id));

    await recordAudit({
      userId: req.user.sub,
      action: "delete",
      entityType: "scheduled_job",
      entityId: id,
      entityName: existing.name,
      description: `${req.user.username} eliminó job programado: ${existing.name}`,
      req,
    });

    return reply.send({ ok: true });
  });
}
