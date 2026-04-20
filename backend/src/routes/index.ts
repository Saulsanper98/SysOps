import type { FastifyInstance } from "fastify";
import { authRoutes } from "./auth";
import { dashboardRoutes } from "./dashboard";
import { incidentRoutes } from "./incidents";
import { automationRoutes } from "./automations";
import { kbRoutes } from "./kb";
import { auditRoutes } from "./audit";
import { alertRoutes } from "./alerts";
import { userRoutes } from "./users";
import { notificationRoutes } from "./notifications";
import { scheduledJobRoutes } from "./scheduledJobs";
import { sshCredentialRoutes } from "./sshCredentials";
import { metricsRoutes } from "./metrics";

export async function registerRoutes(app: FastifyInstance) {
  await app.register(async (a) => { await authRoutes(a); }, { prefix: "/api/auth" });
  await app.register(async (a) => { await dashboardRoutes(a); }, { prefix: "/api/dashboard" });
  await app.register(async (a) => { await incidentRoutes(a); }, { prefix: "/api/incidents" });
  await app.register(async (a) => { await automationRoutes(a); }, { prefix: "/api/automations" });
  await app.register(async (a) => { await kbRoutes(a); }, { prefix: "/api/kb" });
  await app.register(async (a) => { await auditRoutes(a); }, { prefix: "/api/audit" });
  await app.register(async (a) => { await alertRoutes(a); }, { prefix: "/api/alerts" });
  await app.register(async (a) => { await userRoutes(a); }, { prefix: "/api/users" });
  await app.register(async (a) => { await notificationRoutes(a); }, { prefix: "/api/notifications" });
  await app.register(async (a) => { await scheduledJobRoutes(a); }, { prefix: "/api/scheduled-jobs" });
  await app.register(async (a) => { await sshCredentialRoutes(a); }, { prefix: "/api/ssh-credentials" });
  await app.register(async (a) => { await metricsRoutes(a); }, { prefix: "/api/metrics" });
}
