import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/middleware";
import { db, schema } from "../db";
import { eq } from "drizzle-orm";
import { automationQueue } from "../jobs/queue";
import { recordAudit } from "../utils/audit";
import { NotFoundError, ForbiddenError } from "../utils/errors";
import { wsManager } from "../services/wsManager";

const stepSchema = z.object({
  actionId: z.string().uuid(),
  parameters: z.record(z.unknown()).default({}),
});

export async function runbookRoutes(app: FastifyInstance) {
  app.get("/runbooks", { preHandler: requireAuth }, async () => {
    return db.select().from(schema.automationRunbooks).where(eq(schema.automationRunbooks.active, true));
  });

  app.post("/runbooks", { preHandler: requireRole("admin") }, async (req, reply) => {
    const body = z
      .object({
        name: z.string().min(2),
        description: z.string().optional(),
        steps: z.array(stepSchema).min(1).max(20),
        requiredRole: z.enum(["admin", "tecnico", "readonly"]).default("tecnico"),
      })
      .parse(req.body);

    const [rb] = await db
      .insert(schema.automationRunbooks)
      .values({
        name: body.name,
        description: body.description,
        steps: body.steps,
        requiredRole: body.requiredRole,
        createdBy: req.user.sub,
      })
      .returning();

    await recordAudit({
      userId: req.user.sub,
      action: "create",
      entityType: "runbook",
      entityId: rb.id,
      entityName: rb.name,
      description: `Runbook creado: ${rb.name}`,
      req,
    });

    return reply.status(201).send(rb);
  });

  app.post("/runbooks/:id/run", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const [rb] = await db.select().from(schema.automationRunbooks).where(eq(schema.automationRunbooks.id, id)).limit(1);
    if (!rb || !rb.active) throw new NotFoundError("Runbook");

    const roleOrder = { readonly: 0, tecnico: 1, admin: 2 };
    if ((roleOrder[req.user.role as keyof typeof roleOrder] ?? -1) < (roleOrder[rb.requiredRole as keyof typeof roleOrder] ?? 99)) {
      throw new ForbiddenError(`Runbook requiere rol: ${rb.requiredRole}`);
    }

    const steps = rb.steps as { actionId: string; parameters: Record<string, unknown> }[];
    const [run] = await db
      .insert(schema.automationRuns)
      .values({
        actionId: steps[0].actionId,
        triggeredBy: req.user.sub,
        parameters: {
          _runbook: { runbookId: rb.id, steps, stepIndex: 0 },
        },
        status: "pendiente",
      })
      .returning();

    const [firstAction] = await db
      .select()
      .from(schema.automationActions)
      .where(eq(schema.automationActions.id, steps[0].actionId))
      .limit(1);
    if (!firstAction) throw new NotFoundError("Acción runbook");

    const job = await automationQueue.add(
      "runbook-inline",
      {
        runId: run.id,
        actionId: firstAction.id,
        jobName: "runbook-inline",
        parameters: { _runbook: { runbookId: rb.id, steps, stepIndex: 0 } },
        triggeredBy: req.user.sub,
      },
      { attempts: 1 },
    );

    await db.update(schema.automationRuns).set({ jobId: job.id ?? null }).where(eq(schema.automationRuns.id, run.id));

    await recordAudit({
      userId: req.user.sub,
      action: "execute",
      entityType: "runbook_run",
      entityId: run.id,
      entityName: rb.name,
      description: `Ejecución runbook: ${rb.name}`,
      req,
    });

    wsManager.broadcast({ type: "invalidate", scopes: ["automations"] });

    return reply.status(202).send({ runId: run.id, jobId: job.id });
  });
}
