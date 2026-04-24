import cron from "node-cron";
import { db, schema } from "../db";
import { eq, inArray } from "drizzle-orm";
import { automationQueue } from "./queue";
import { logger } from "../utils/logger";

type ScheduledJob = typeof schema.scheduledJobs.$inferSelect;

class ScheduledJobsRunner {
  private tasks = new Map<string, cron.ScheduledTask>();

  async init(): Promise<void> {
    try {
      const jobs = await db
        .select()
        .from(schema.scheduledJobs)
        .where(eq(schema.scheduledJobs.enabled, true));

      for (const job of jobs) {
        this.schedule(job);
      }

      logger.info({ count: jobs.length }, "ScheduledJobsRunner initialized");
    } catch (err: any) {
      logger.error({ err: err.message }, "ScheduledJobsRunner init failed");
    }
  }

  schedule(job: ScheduledJob): void {
    if (this.tasks.has(job.id)) {
      this.unschedule(job.id);
    }

    if (!cron.validate(job.cronExpression)) {
      logger.warn({ jobId: job.id, expr: job.cronExpression }, "Invalid cron expression — not scheduling");
      return;
    }

    const task = cron.schedule(job.cronExpression, () => {
      this.runJob(job).catch((err) =>
        logger.error({ jobId: job.id, err: err.message }, "Scheduled job execution error"),
      );
    });

    this.tasks.set(job.id, task);
    logger.debug({ jobId: job.id, name: job.name, expr: job.cronExpression }, "Job scheduled");
  }

  unschedule(jobId: string): void {
    const task = this.tasks.get(jobId);
    if (task) {
      task.stop();
      this.tasks.delete(jobId);
      logger.debug({ jobId }, "Job unscheduled");
    }
  }

  reschedule(job: ScheduledJob): void {
    this.unschedule(job.id);
    if (job.enabled) {
      this.schedule(job);
    }
  }

  private async runJob(job: ScheduledJob): Promise<void> {
    try {
      // Determine user to run as
      let runAsUserId = job.runAsUserId;

      if (!runAsUserId) {
        const [adminUser] = await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.role, "admin"))
          .limit(1);
        runAsUserId = adminUser?.id;
      }

      if (!runAsUserId) {
        logger.warn({ jobId: job.id }, "No user found to run job as — skipping");
        return;
      }

      // Get action for this job
      const [action] = await db
        .select()
        .from(schema.automationActions)
        .where(eq(schema.automationActions.id, job.actionId))
        .limit(1);

      if (!action) {
        logger.warn({ jobId: job.id, actionId: job.actionId }, "Action not found for scheduled job");
        return;
      }

      // Create automation run record
      const [run] = await db
        .insert(schema.automationRuns)
        .values({
          actionId: job.actionId,
          triggeredBy: runAsUserId,
          parameters: job.parameters as Record<string, unknown>,
          status: "pendiente",
        })
        .returning({ id: schema.automationRuns.id });

      // Enqueue in BullMQ
      await automationQueue.add(action.jobName, {
        runId: run.id,
        actionId: job.actionId,
        jobName: action.jobName,
        parameters: job.parameters as Record<string, unknown>,
        triggeredBy: runAsUserId,
      });

      // Update job timestamps
      const now = new Date();
      await db
        .update(schema.scheduledJobs)
        .set({
          lastRun: now,
          lastRunStatus: "enqueued",
          updatedAt: now,
        })
        .where(eq(schema.scheduledJobs.id, job.id));

      logger.info({ jobId: job.id, runId: run.id, action: action.jobName }, "Scheduled job enqueued");
    } catch (err: any) {
      // Record failure in lastRunStatus
      await db
        .update(schema.scheduledJobs)
        .set({ lastRun: new Date(), lastRunStatus: `error: ${err.message}`, updatedAt: new Date() })
        .where(eq(schema.scheduledJobs.id, job.id))
        .catch(() => {});

      logger.error({ jobId: job.id, err: err.message }, "Scheduled job run failed");
      throw err;
    }
  }
}

export const scheduledJobsRunner = new ScheduledJobsRunner();
