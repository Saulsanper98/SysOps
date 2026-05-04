import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { config } from "../config";
import { db, schema } from "../db";
import { and, eq } from "drizzle-orm";
import { ingestAlertRow } from "../services/alertIngest";
import { wsManager } from "../services/wsManager";
import { logger } from "../utils/logger";

const severityZ = z.enum(["critica", "alta", "media", "baja", "info"]).default("media");

const genericBody = z.object({
  source: z.enum(["zabbix", "uptime_kuma", "proxmox", "vcenter", "portainer", "nas", "m365", "qnap", "hikvision"]),
  title: z.string().min(1),
  description: z.string().optional(),
  severity: severityZ,
  externalId: z.string().optional(),
  systemId: z.string().uuid().optional(),
  systemMatch: z
    .object({
      connectorType: z.enum(["zabbix", "uptime_kuma", "proxmox", "vcenter", "portainer", "nas", "m365", "qnap", "hikvision"]),
      connectorId: z.string().min(1),
    })
    .optional(),
});

/** Webhooks entrantes (sin JWT): autenticación por cabecera X-Ingest-Secret. */
export async function ingestRoutes(app: FastifyInstance) {
  app.post("/alerts", async (req, reply) => {
    if (!config.INGEST_WEBHOOK_SECRET) {
      return reply.status(503).send({ error: "Ingest no configurado (INGEST_WEBHOOK_SECRET)" });
    }
    const hdr = req.headers["x-ingest-secret"];
    if (hdr !== config.INGEST_WEBHOOK_SECRET) {
      return reply.status(401).send({ error: "Secreto inválido" });
    }

    const body = genericBody.parse(req.body);

    let systemId: string | null | undefined = body.systemId;
    if (!systemId && body.systemMatch) {
      const [sys] = await db
        .select({ id: schema.systems.id })
        .from(schema.systems)
        .where(
          and(
            eq(schema.systems.connectorType, body.systemMatch.connectorType as any),
            eq(schema.systems.connectorId, body.systemMatch.connectorId),
          ),
        )
        .limit(1);
      systemId = sys?.id ?? null;
    }

    const result = await ingestAlertRow({
      source: body.source,
      title: body.title,
      description: body.description,
      severity: body.severity,
      externalId: body.externalId,
      systemId: systemId ?? null,
      metadata: { ingest: true, receivedAt: new Date().toISOString() },
    });

    logger.info({ alertId: result.id, autoLinked: result.autoLinkedIncidentId }, "ingest alert");

    wsManager.broadcast({ type: "invalidate", scopes: ["alerts", "incidents", "dashboard"] });

    return reply.status(201).send(result);
  });
}
