import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyWebsocket from "@fastify/websocket";
import { config } from "./config";
import { logger } from "./utils/logger";
import { checkDbConnection } from "./db";
import { registerRoutes } from "./routes";
import { registry } from "./connectors/registry";
import { startWorker, automationQueue } from "./jobs/queue";
import { scheduledJobsRunner } from "./jobs/scheduledJobsRunner";
import { collectMetrics } from "./jobs/metricsCollector";
import { runAutoIncidentCheck } from "./jobs/autoIncidentCron";
import { wsManager } from "./services/wsManager";
import cron from "node-cron";
import { AppError } from "./utils/errors";

const app = Fastify({
  logger: {
    level: config.NODE_ENV === "production" ? "info" : "debug",
    transport:
      config.NODE_ENV !== "production"
        ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" } }
        : undefined,
  },
  trustProxy: true,
});

async function bootstrap() {
  // ─── Plugins ────────────────────────────────────────────────────────
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });

  await app.register(fastifyCors, {
    origin: (origin, cb) => {
      // Allow desktop launcher/webview requests that may send no origin or Origin: null
      if (!origin || origin === "null") return cb(null, true);

      const allowed = new Set([
        config.FRONTEND_URL,
        "http://localhost:5173",
        "http://localhost:5183",
        "http://localhost:80",
      ]);
      if (allowed.has(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  await app.register(fastifyRateLimit, {
    max: 200,
    timeWindow: "1 minute",
    errorResponseBuilder: () => ({ error: "Demasiadas peticiones. Espera un momento." }),
  });

  await app.register(fastifyJwt, {
    secret: config.JWT_SECRET,
    sign: { expiresIn: config.JWT_EXPIRES_IN },
  });

  await app.register(fastifyWebsocket);

  // ─── WebSocket for real-time dashboard ──────────────────────────────
  app.register(async (wsApp) => {
    wsApp.get("/ws", { websocket: true }, (connection, req) => {
      // Authenticate via query param token (WS can't set Authorization header)
      let userId: string | null = null;
      try {
        const token = (req.query as Record<string, string>).token;
        if (token) {
          const payload = (app as any).jwt.verify(token) as { sub: string };
          userId = payload.sub;
          wsManager.register(userId, connection);
        }
      } catch {
        // Unauthenticated WS — still gets pings but no targeted notifications
      }

      const interval = setInterval(() => {
        if (connection.socket.readyState !== 1) {
          clearInterval(interval);
          return;
        }
        try {
          connection.socket.send(JSON.stringify({ type: "ping", timestamp: new Date().toISOString() }));
        } catch {}
      }, 30000);

      connection.socket.on("close", () => {
        clearInterval(interval);
        if (userId) wsManager.unregister(userId, connection);
      });
    });
  });

  // ─── Error handler ───────────────────────────────────────────────────
  app.setErrorHandler((error, req, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: error.message,
        code: error.code,
      });
    }
    if (error.validation) {
      return reply.status(400).send({ error: "Datos inválidos", details: error.validation });
    }
    logger.error({ err: error, url: req.url, method: req.method }, "Unhandled error");
    return reply.status(500).send({ error: "Error interno del servidor" });
  });

  // ─── Routes ──────────────────────────────────────────────────────────
  await registerRoutes(app);

  app.get("/health", async () => ({
    status: "ok",
    version: "1.0.0",
    demoMode: config.DEMO_MODE,
    timestamp: new Date().toISOString(),
  }));

  // ─── DB ──────────────────────────────────────────────────────────────
  const dbOk = await checkDbConnection();
  if (!dbOk) {
    logger.error("Cannot connect to database. Exiting.");
    process.exit(1);
  }
  logger.info("Database connection OK");

  // ─── Connectors ──────────────────────────────────────────────────────
  await registry.init();

  // ─── Workers ─────────────────────────────────────────────────────────
  await startWorker();

  // ─── Scheduled jobs runner ────────────────────────────────────────────
  await scheduledJobsRunner.init();

  // ─── Cron jobs ────────────────────────────────────────────────────────
  // Connector health checks every 2 minutes (parallel)
  cron.schedule("*/2 * * * *", async () => {
    try {
      await registry.checkAll();
      logger.debug("Connector health check cycle done");
    } catch (err) {
      logger.error({ err }, "Scheduled health check failed");
    }
  });

  // Metrics collection every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    try {
      await collectMetrics();
      logger.debug("Metrics collected");
    } catch (err) {
      logger.error({ err }, "Metrics collection failed");
    }
  });

  // Auto-incident check every 10 minutes
  cron.schedule("*/10 * * * *", async () => {
    try {
      await runAutoIncidentCheck();
      logger.debug("Auto-incident check done");
    } catch (err) {
      logger.error({ err }, "Auto-incident check failed");
    }
  });

  // ─── Start server ─────────────────────────────────────────────────────
  await app.listen({ port: config.PORT, host: "0.0.0.0" });
  logger.info(`SysOps Hub backend running on port ${config.PORT}`);
  logger.info(`Demo mode: ${config.DEMO_MODE}`);
}

bootstrap().catch((err) => {
  logger.error(err, "Fatal error during bootstrap");
  process.exit(1);
});
