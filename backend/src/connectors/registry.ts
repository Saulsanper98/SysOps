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

  init() {
    if (config.DEMO_MODE) {
      const types = ["zabbix", "uptime_kuma", "proxmox", "vcenter", "portainer", "nas"] as const;
      const names: Record<string, string> = {
        zabbix: "Zabbix",
        uptime_kuma: "Uptime Kuma",
        proxmox: "Proxmox",
        vcenter: "VMware vCenter",
        portainer: "Portainer",
        nas: "NAS/Almacenamiento",
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
    const entries = [...this.connectors.entries()];

    const results = await Promise.all(
      entries.map(async ([type, connector]) => {
        const start = Date.now();
        let health: ConnectorHealth;

        try {
          health = await Promise.race([
            connector.healthCheck(),
            new Promise<ConnectorHealth>((_, rej) =>
              setTimeout(() => rej(new Error("Timeout (5s)")), 5000),
            ),
          ]);
        } catch (err: any) {
          health = { healthy: false, error: err.message, latencyMs: Date.now() - start };
        }

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
          })
          .catch((e) => logger.warn({ e }, "Failed to update connector status"));

        return {
          type,
          displayName: connector.displayName,
          ...health,
        } as ConnectorResult;
      }),
    );

    return results;
  }

  async getAllAlerts(): Promise<AlertSummary[]> {
    if (config.DEMO_MODE) return mockAlerts;

    const all = await Promise.allSettled(
      [...this.connectors.values()].map((c) => c.getAlerts()),
    );

    return all.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  }

  async getAllSystems(): Promise<SystemStatus[]> {
    if (config.DEMO_MODE) return mockSystems;

    const all = await Promise.allSettled(
      [...this.connectors.values()].map((c) => c.getSystems()),
    );

    return all.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  }

  get(type: string): BaseConnector | undefined {
    return this.connectors.get(type);
  }
}

export const registry = new ConnectorRegistry();
