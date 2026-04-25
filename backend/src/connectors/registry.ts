import { config } from "../config";
import { BaseConnector, type ConnectorHealth, type AlertSummary, type SystemStatus } from "./base";
import { ZabbixConnector } from "./zabbix";
import { UptimeKumaConnector } from "./uptimeKuma";
import { ProxmoxConnector } from "./proxmox";
import { VCenterConnector } from "./vcenter";
import { PortainerConnector } from "./portainer";
import { NasConnector } from "./nas";
import { MockConnector, mockAlerts, mockSystems } from "./mock";
import { QnapConnector } from "./qnap";
import { HikvisionConnector } from "./hikvision";
import { logger } from "../utils/logger";
import { db, schema } from "../db";
import { eq } from "drizzle-orm";

export interface ConnectorResult {
  type: string;
  displayName: string;
  healthy: boolean;
  latencyMs?: number;
  error?: string;
}

class ConnectorRegistry {
  private connectors: Map<string, BaseConnector> = new Map();
  private static readonly CONNECTOR_TIMEOUT_MS = 5000;
  private static readonly CACHE_TTL_MS = 30000;
  private disabledStatusWrites = new Set<string>();
  private healthCache: { ts: number; data: ConnectorResult[] } | null = null;
  private alertsCache: { ts: number; data: AlertSummary[] } | null = null;
  private systemsCache: { ts: number; data: SystemStatus[] } | null = null;
  private inflightHealth: Promise<ConnectorResult[]> | null = null;
  private inflightAlerts: Promise<AlertSummary[]> | null = null;
  private inflightSystems: Promise<SystemStatus[]> | null = null;

  private withTimeout<T>(promise: Promise<T>, label: string, timeoutMs = ConnectorRegistry.CONNECTOR_TIMEOUT_MS): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error(`${label} timeout (${timeoutMs}ms)`)), timeoutMs);
      }),
    ]);
  }

  init() {
    if (config.DEMO_MODE) {
      const types = ["zabbix", "uptime_kuma", "proxmox", "vcenter", "portainer", "nas", "hikvision"] as const;
      const names: Record<string, string> = {
        zabbix: "Zabbix",
        uptime_kuma: "Uptime Kuma",
        proxmox: "Proxmox",
        vcenter: "VMware vCenter",
        portainer: "Portainer",
        nas: "NAS/Almacenamiento",
        hikvision: "Hikvision NVR",
      };
      for (const t of types) {
        this.connectors.set(t, new MockConnector(t, names[t]));
      }
      logger.info("Connector registry: DEMO MODE — all connectors mocked");
      return;
    }

    if (config.ZABBIX_URL) this.connectors.set("zabbix", new ZabbixConnector());
    if (config.UPTIME_KUMA_URL) this.connectors.set("uptime_kuma", new UptimeKumaConnector());
    if (config.PROXMOX_URL) this.connectors.set("proxmox", new ProxmoxConnector());
    if (config.VCENTER_URL) this.connectors.set("vcenter", new VCenterConnector());
    if (config.PORTAINER_URL) this.connectors.set("portainer", new PortainerConnector());
    if (config.NAS_URL) this.connectors.set("nas", new NasConnector());
    if (config.QNAP_URL) this.connectors.set("qnap", new QnapConnector());
    if (config.HIKVISION_URL) this.connectors.set("hikvision", new HikvisionConnector());

    logger.info({ connectors: [...this.connectors.keys()] }, "Connector registry initialized");
  }

  async checkAll(): Promise<ConnectorResult[]> {
    if (this.healthCache && Date.now() - this.healthCache.ts < ConnectorRegistry.CACHE_TTL_MS) {
      return this.healthCache.data;
    }
    if (this.inflightHealth) return this.inflightHealth;

    const entries = [...this.connectors.entries()];
    this.inflightHealth = (async () => {
      const results = await Promise.all(
        entries.map(async ([type, connector]) => {
          const start = Date.now();
          let health: ConnectorHealth;

          try {
            health = await this.withTimeout(
              connector.healthCheck(),
              `${connector.displayName} healthCheck`,
            );
          } catch (err: any) {
            health = { healthy: false, error: err.message, latencyMs: Date.now() - start };
          }

          if (!this.disabledStatusWrites.has(type)) {
            try {
              await db
                .insert(schema.connectorStatus)
                .values({
                  type: type as any,
                  name: connector.displayName,
                  healthy: health.healthy,
                  lastCheck: new Date(),
                  lastError: health.error ?? null,
                  latencyMs: health.latencyMs ?? null,
                })
                .onConflictDoUpdate({
                  target: schema.connectorStatus.type,
                  set: {
                    healthy: health.healthy,
                    lastCheck: new Date(),
                    lastError: health.error ?? null,
                    latencyMs: health.latencyMs ?? null,
                    updatedAt: new Date(),
                  },
                });
            } catch (e: any) {
              const pgCode = e?.cause?.code ?? e?.code;
              if (pgCode === "22P02") {
                this.disabledStatusWrites.add(type);
                logger.warn({ type, pgCode }, "Connector status writes disabled for unsupported enum value");
              } else {
                logger.warn({ e }, "Failed to update connector status");
              }
            }
          }

          return {
            type,
            displayName: connector.displayName,
            ...health,
          } as ConnectorResult;
        }),
      );

      this.healthCache = { ts: Date.now(), data: results };
      return results;
    })();

    try {
      return await this.inflightHealth;
    } finally {
      this.inflightHealth = null;
    }
  }

  async getAllAlerts(): Promise<AlertSummary[]> {
    if (config.DEMO_MODE) return mockAlerts;
    if (this.alertsCache && Date.now() - this.alertsCache.ts < ConnectorRegistry.CACHE_TTL_MS) {
      return this.alertsCache.data;
    }
    if (this.inflightAlerts) return this.inflightAlerts;

    this.inflightAlerts = (async () => {
      const all = await Promise.allSettled(
        [...this.connectors.values()].map((c) =>
          this.withTimeout(c.getAlerts(), `${c.displayName} getAlerts`),
        ),
      );

      for (const r of all) {
        if (r.status === "rejected") {
          logger.warn({ error: r.reason?.message ?? String(r.reason) }, "Connector getAlerts failed");
        }
      }

      const merged = all.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
      this.alertsCache = { ts: Date.now(), data: merged };
      return merged;
    })();

    try {
      return await this.inflightAlerts;
    } finally {
      this.inflightAlerts = null;
    }
  }

  async getAllSystems(): Promise<SystemStatus[]> {
    if (config.DEMO_MODE) return mockSystems;
    if (this.systemsCache && Date.now() - this.systemsCache.ts < ConnectorRegistry.CACHE_TTL_MS) {
      return this.systemsCache.data;
    }
    if (this.inflightSystems) return this.inflightSystems;

    this.inflightSystems = (async () => {
      const all = await Promise.allSettled(
        [...this.connectors.values()].map((c) =>
          this.withTimeout(c.getSystems(), `${c.displayName} getSystems`),
        ),
      );

      for (const r of all) {
        if (r.status === "rejected") {
          logger.warn({ error: r.reason?.message ?? String(r.reason) }, "Connector getSystems failed");
        }
      }

      const merged = all.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
      this.systemsCache = { ts: Date.now(), data: merged };
      return merged;
    })();

    try {
      return await this.inflightSystems;
    } finally {
      this.inflightSystems = null;
    }
  }

  get(type: string): BaseConnector | undefined {
    return this.connectors.get(type);
  }
}

export const registry = new ConnectorRegistry();
