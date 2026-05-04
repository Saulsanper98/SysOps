import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRole } from "../auth/middleware";
import {
  listConnectorSettingsForApi,
  upsertConnectorSetting,
  deleteConnectorSetting,
  mergeConnectorPayloads,
  getDecryptedPayloadForType,
  hydrateConnectorStoreFromDatabase,
  type ConnectorSettingType,
} from "../services/connectorSettingsService";
import { registry } from "../connectors/registry";
import {
  snapshotConnectorStore,
  restoreConnectorStore,
  replaceConnectorStoreSnapshot,
} from "../connectors/dynamicConnectorConfig";
import { ValidationError } from "../utils/errors";

const connectorTypeSchema = z.enum([
  "zabbix",
  "uptime_kuma",
  "proxmox",
  "vcenter",
  "portainer",
  "nas",
  "qnap",
  "hikvision",
]);

const putBodySchema = z.object({
  enabled: z.boolean(),
  payload: z.record(z.unknown()).optional().default({}),
});

const testBodySchema = z.object({
  payload: z.record(z.unknown()),
});

export async function connectorSettingsRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: requireRole("admin") }, async () => {
    return listConnectorSettingsForApi();
  });

  app.put<{ Params: { type: string }; Body: z.infer<typeof putBodySchema> }>(
    "/:type",
    { preHandler: requireRole("admin") },
    async (req) => {
      const type = connectorTypeSchema.parse(req.params.type);
      const body = putBodySchema.parse(req.body);
      await upsertConnectorSetting(type, body.enabled, body.payload as Record<string, unknown>);
      registry.reinitConnectors();
      return { ok: true };
    },
  );

  app.delete<{ Params: { type: string } }>(
    "/:type",
    { preHandler: requireRole("admin") },
    async (req) => {
      const type = connectorTypeSchema.parse(req.params.type);
      await deleteConnectorSetting(type);
      registry.reinitConnectors();
      return { ok: true };
    },
  );

  app.post<{ Params: { type: string }; Body: z.infer<typeof testBodySchema> }>(
    "/:type/test",
    { preHandler: requireRole("admin") },
    async (req) => {
      const type = connectorTypeSchema.parse(req.params.type) as ConnectorSettingType;
      const body = testBodySchema.parse(req.body);

      const prevSnap = snapshotConnectorStore();
      try {
        const current = JSON.parse(prevSnap || "{}") as Record<string, Record<string, unknown>>;
        const fromDb = await getDecryptedPayloadForType(type);
        const merged = mergeConnectorPayloads(fromDb ?? current[type], body.payload as Record<string, unknown>);
        current[type] = merged;
        replaceConnectorStoreSnapshot(current);

        registry.reinitConnectors();
        const connector = registry.get(type);
        if (!connector) {
          throw new ValidationError(
            "No hay URL o datos suficientes para probar este conector. Completa la URL o guarda antes.",
          );
        }
        return await connector.healthCheck();
      } finally {
        restoreConnectorStore(prevSnap);
        await hydrateConnectorStoreFromDatabase();
        registry.reinitConnectors();
      }
    },
  );
}
