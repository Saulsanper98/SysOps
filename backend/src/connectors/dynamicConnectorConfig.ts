/**
 * Credenciales y URLs de conectores: prioridad valores guardados en BD (tabla connector_settings)
 * sobre variables de entorno. Se hidrata con hydrateConnectorStoreFromDatabase().
 */
import { config } from "../config";

type Payload = Record<string, unknown>;
const store: Partial<Record<string, Payload>> = {};

export function replaceConnectorStoreSnapshot(snapshot: Partial<Record<string, Payload>>) {
  for (const k of Object.keys(store)) delete store[k];
  Object.assign(store, snapshot);
}

export function setConnectorPayload(type: string, payload: Payload | undefined) {
  if (payload === undefined) delete store[type];
  else store[type] = payload;
}

export function getConnectorPayload(type: string): Payload | undefined {
  return store[type];
}

/** Serializa el store en memoria (para prueba de conexión sin persistir). */
export function snapshotConnectorStore(): string {
  return JSON.stringify(store);
}

export function restoreConnectorStore(raw: string) {
  try {
    replaceConnectorStoreSnapshot(JSON.parse(raw) as Partial<Record<string, Payload>>);
  } catch {
    replaceConnectorStoreSnapshot({});
  }
}

function str(type: string, key: string, env?: string): string | undefined {
  const v = store[type]?.[key];
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  return env?.trim() || undefined;
}

function bool(type: string, key: string, env: boolean): boolean {
  const v = store[type]?.[key];
  if (typeof v === "boolean") return v;
  return env;
}

export const dyn = {
  zabbixUrl: () => str("zabbix", "url", config.ZABBIX_URL),
  zabbixUser: () => str("zabbix", "user", config.ZABBIX_USER),
  zabbixPassword: () => str("zabbix", "password", config.ZABBIX_PASSWORD),

  uptimeUrl: () => str("uptime_kuma", "url", config.UPTIME_KUMA_URL),
  uptimeApiKey: () => str("uptime_kuma", "apiKey", config.UPTIME_KUMA_API_KEY),

  proxmoxUrl: () => str("proxmox", "url", config.PROXMOX_URL),
  proxmoxUser: () => str("proxmox", "user", config.PROXMOX_USER),
  proxmoxPassword: () => str("proxmox", "password", config.PROXMOX_PASSWORD),
  proxmoxVerifySsl: () => bool("proxmox", "verifySsl", config.PROXMOX_VERIFY_SSL),

  vcenterUrl: () => str("vcenter", "url", config.VCENTER_URL),
  vcenterUser: () => str("vcenter", "user", config.VCENTER_USER),
  vcenterPassword: () => str("vcenter", "password", config.VCENTER_PASSWORD),

  portainerUrl: () => str("portainer", "url", config.PORTAINER_URL),
  portainerApiKey: () => str("portainer", "apiKey", config.PORTAINER_API_KEY),
  portainerUser: () => str("portainer", "user", config.PORTAINER_USER),
  portainerPassword: () => str("portainer", "password", config.PORTAINER_PASSWORD),

  nasUrl: () => str("nas", "url", config.NAS_URL),
  nasUser: () => str("nas", "user", config.NAS_USER),
  nasPassword: () => str("nas", "password", config.NAS_PASSWORD),

  qnapUrl: () => str("qnap", "url", config.QNAP_URL),
  qnapUser: () => str("qnap", "user", config.QNAP_USER),
  qnapPassword: () => str("qnap", "password", config.QNAP_PASSWORD),

  hikvisionUrl: () => str("hikvision", "url", config.HIKVISION_URL),
  hikvisionUser: () => str("hikvision", "user", config.HIKVISION_USER),
  hikvisionPassword: () => str("hikvision", "password", config.HIKVISION_PASSWORD),

  /** Tenant Azure AD (preview M365); también se puede guardar en connector_settings tipo m365. */
  m365TenantId: () => str("m365", "tenantId", config.M365_TENANT_ID),
};
