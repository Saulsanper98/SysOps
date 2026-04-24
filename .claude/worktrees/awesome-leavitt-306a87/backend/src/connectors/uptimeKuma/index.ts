import axios, { type AxiosInstance } from "axios";
import { BaseConnector, type ConnectorHealth, type AlertSummary, type SystemStatus } from "../base";
import { config } from "../../config";
import { logger } from "../../utils/logger";

// Uptime Kuma heartbeat status codes
// 0 = Down, 1 = Up, 2 = Pending, 3 = Maintenance

export class UptimeKumaConnector extends BaseConnector {
  readonly type = "uptime_kuma";
  readonly displayName = "Uptime Kuma";

  private client: AxiosInstance;

  constructor() {
    super();
    this.client = axios.create({
      baseURL: config.UPTIME_KUMA_URL,
      timeout: 10000,
      headers: config.UPTIME_KUMA_API_KEY
        ? { Authorization: `Bearer ${config.UPTIME_KUMA_API_KEY}` }
        : {},
    });
  }

  async healthCheck(): Promise<ConnectorHealth> {
    const start = Date.now();
    try {
      // Try authenticated endpoint first; fall back to public status page
      if (config.UPTIME_KUMA_API_KEY) {
        const { data } = await this.client.get("/api/monitor", { timeout: 5000 });
        const count = data?.monitors?.length ?? 0;
        return {
          healthy: true,
          latencyMs: Date.now() - start,
          details: { monitors: count },
        };
      } else {
        // No API key — just check the app is reachable
        await this.client.get("/", { timeout: 5000 });
        return {
          healthy: false,
          latencyMs: Date.now() - start,
          error: "API key not configured — go to Settings → API Keys in Uptime Kuma",
        };
      }
    } catch (err: any) {
      return { healthy: false, error: err.message, latencyMs: Date.now() - start };
    }
  }

  async getAlerts(): Promise<AlertSummary[]> {
    if (!config.UPTIME_KUMA_API_KEY) return [];

    try {
      const { data } = await this.client.get("/api/monitor");
      const monitors: any[] = data?.monitors ?? [];

      return monitors
        .filter((m) => {
          const isActive = m.active === 1 || m.active === true;
          const isDown = m.heartbeat?.status === 0;
          return isActive && isDown;
        })
        .map((m) => ({
          externalId: String(m.id),
          title: `Servicio caído: ${m.name}`,
          description: m.url ? `${m.type?.toUpperCase()} → ${m.url}` : `Monitor tipo ${m.type}`,
          severity: "alta" as const,
          systemName: m.name,
          firedAt: m.heartbeat?.time ? new Date(m.heartbeat.time) : new Date(),
          metadata: {
            url: m.url ?? null,
            type: m.type,
            source: "uptime_kuma",
          },
        }));
    } catch (err: any) {
      logger.error({ err: err.message }, "UptimeKuma getAlerts failed");
      return [];
    }
  }

  async getSystems(): Promise<SystemStatus[]> {
    if (!config.UPTIME_KUMA_API_KEY) return [];

    try {
      const { data } = await this.client.get("/api/monitor");
      const monitors: any[] = data?.monitors ?? [];

      return monitors
        .filter((m) => m.active === 1 || m.active === true)
        .map((m) => {
          const hbStatus: number = m.heartbeat?.status ?? -1;
          let status: SystemStatus["status"];
          if (hbStatus === 1) status = "ok";
          else if (hbStatus === 0) status = "critico";
          else if (hbStatus === 3) status = "degradado"; // maintenance
          else status = "desconocido";

          return {
            externalId: String(m.id),
            name: m.name,
            type: "service",
            status,
            metadata: {
              url: m.url ?? null,
              monitorType: m.type,
              uptime24h: m.uptime ?? null,
              source: "uptime_kuma",
            },
          };
        });
    } catch (err: any) {
      logger.error({ err: err.message }, "UptimeKuma getSystems failed");
      return [];
    }
  }
}
