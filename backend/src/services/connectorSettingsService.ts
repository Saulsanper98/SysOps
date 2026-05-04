import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { encrypt, decrypt } from "./encryptionService";
import { replaceConnectorStoreSnapshot } from "../connectors/dynamicConnectorConfig";
import { logger } from "../utils/logger";

export type ConnectorSettingType =
  | "zabbix"
  | "uptime_kuma"
  | "proxmox"
  | "vcenter"
  | "portainer"
  | "nas"
  | "qnap"
  | "hikvision";

const SECRET_KEYS = new Set(["password", "apiKey", "privateKey", "token"]);

export async function hydrateConnectorStoreFromDatabase(): Promise<void> {
  const rows = await db.select().from(schema.connectorSettings);
  const snap: Partial<Record<string, Record<string, unknown>>> = {};
  for (const row of rows) {
    if (!row.enabled || !row.payloadEncrypted) continue;
    try {
      const json = JSON.parse(decrypt(row.payloadEncrypted)) as Record<string, unknown>;
      snap[row.type] = json;
    } catch (e) {
      logger.warn({ type: row.type, e }, "connector_settings: payload inválido, se omite");
    }
  }
  replaceConnectorStoreSnapshot(snap);
}

function maskPayload(payload: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!payload) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (SECRET_KEYS.has(k) && typeof v === "string" && v.length > 0) out[k] = "********";
    else out[k] = v;
  }
  return out;
}

export async function listConnectorSettingsForApi(): Promise<
  { type: string; enabled: boolean; payloadMasked: Record<string, unknown> }[]
> {
  const rows = await db.select().from(schema.connectorSettings);
  const byType = new Map(rows.map((r) => [r.type, r]));
  const types: ConnectorSettingType[] = [
    "zabbix",
    "uptime_kuma",
    "proxmox",
    "vcenter",
    "portainer",
    "nas",
    "qnap",
    "hikvision",
  ];
  const out: { type: string; enabled: boolean; payloadMasked: Record<string, unknown> }[] = [];
  for (const t of types) {
    const row = byType.get(t);
    let payload: Record<string, unknown> | undefined;
    if (row?.payloadEncrypted) {
      try {
        payload = JSON.parse(decrypt(row.payloadEncrypted)) as Record<string, unknown>;
      } catch {
        payload = {};
      }
    }
    out.push({
      type: t,
      enabled: row?.enabled ?? false,
      payloadMasked: maskPayload(payload),
    });
  }
  return out;
}

export function mergeConnectorPayloads(
  prev: Record<string, unknown> | undefined,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...(prev ?? {}) };
  for (const [k, v] of Object.entries(incoming)) {
    if (v === undefined) continue;
    if (SECRET_KEYS.has(k) && typeof v === "string" && v.trim() === "") continue;
    merged[k] = v;
  }
  return merged;
}

export async function upsertConnectorSetting(
  type: ConnectorSettingType,
  enabled: boolean,
  incomingPayload: Record<string, unknown>,
): Promise<void> {
  const [existing] = await db.select().from(schema.connectorSettings).where(eq(schema.connectorSettings.type, type));

  let prev: Record<string, unknown> | undefined;
  if (existing?.payloadEncrypted) {
    try {
      prev = JSON.parse(decrypt(existing.payloadEncrypted)) as Record<string, unknown>;
    } catch {
      prev = {};
    }
  }

  const merged = mergeConnectorPayloads(prev, incomingPayload);

  await db
    .insert(schema.connectorSettings)
    .values({
      type,
      enabled,
      payloadEncrypted: encrypt(JSON.stringify(merged)),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.connectorSettings.type,
      set: {
        enabled,
        payloadEncrypted: encrypt(JSON.stringify(merged)),
        updatedAt: new Date(),
      },
    });

  await hydrateConnectorStoreFromDatabase();
}

export async function deleteConnectorSetting(type: ConnectorSettingType): Promise<void> {
  await db.delete(schema.connectorSettings).where(eq(schema.connectorSettings.type, type));
  await hydrateConnectorStoreFromDatabase();
}

export async function getDecryptedPayloadForType(
  type: ConnectorSettingType,
): Promise<Record<string, unknown> | undefined> {
  const [row] = await db.select().from(schema.connectorSettings).where(eq(schema.connectorSettings.type, type));
  if (!row?.payloadEncrypted) return undefined;
  try {
    return JSON.parse(decrypt(row.payloadEncrypted)) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}
