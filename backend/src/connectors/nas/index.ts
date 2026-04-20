import axios from "axios";
import https from "https";
import { BaseConnector, type ConnectorHealth, type AlertSummary, type SystemStatus } from "../base";
import { config } from "../../config";
import { logger } from "../../utils/logger";

// Synology DSM 6/7 API implementation
export class NasConnector extends BaseConnector {
  readonly type = "nas";
  readonly displayName = "NAS/Almacenamiento";

  private sid: string | null = null;
  private sidExpiry = 0;

  // Ignore self-signed certificates (common in Synology)
  private readonly httpsAgent = new https.Agent({ rejectUnauthorized: false });

  private get baseURL() {
    return (config.NAS_URL ?? "").replace(/\/$/, "");
  }

  private async login(): Promise<string> {
    if (this.sid && Date.now() < this.sidExpiry) return this.sid;

    const { data } = await axios.get(`${this.baseURL}/webapi/auth.cgi`, {
      params: {
        api: "SYNO.API.Auth",
        version: 3,
        method: "login",
        account: config.NAS_USER,
        passwd: config.NAS_PASSWORD,
        session: "SysOpsHub",
        format: "sid",
      },
      httpsAgent: this.httpsAgent,
      timeout: 8000,
    });

    if (!data.success) {
      throw new Error(`NAS auth failed: ${JSON.stringify(data.error ?? data)}`);
    }

    this.sid = data.data.sid;
    this.sidExpiry = Date.now() + 30 * 60 * 1000; // 30 min
    return this.sid!;
  }

  private async apiGet(api: string, version: number, method: string, extra: Record<string, unknown> = {}) {
    const sid = await this.login();
    const { data } = await axios.get(`${this.baseURL}/webapi/entry.cgi`, {
      params: { api, version, method, _sid: sid, ...extra },
      httpsAgent: this.httpsAgent,
      timeout: 8000,
    });
    return data;
  }

  async healthCheck(): Promise<ConnectorHealth> {
    const start = Date.now();
    try {
      await this.login();
      const data = await this.apiGet("SYNO.Core.System", 1, "info");
      return {
        healthy: true,
        latencyMs: Date.now() - start,
        details: {
          model: data.data?.model ?? "unknown",
          firmware: data.data?.firmware_ver ?? "unknown",
          hostname: data.data?.hostname ?? "NAS",
        },
      };
    } catch (err: any) {
      return { healthy: false, error: err.message, latencyMs: Date.now() - start };
    }
  }

  async getAlerts(): Promise<AlertSummary[]> {
    try {
      // System logs — errors only
      const data = await this.apiGet("SYNO.Core.System.SystemLog", 1, "list", { rows: 50 });
      if (!data.success) return [];

      const alerts: AlertSummary[] = (data.data?.items ?? [])
        .filter((l: any) => l.type === "err" || l.type === "crit")
        .map((l: any) => ({
          externalId: `nas-log-${l.id ?? Math.random()}`,
          title: l.desc ?? "Error NAS",
          severity: l.type === "crit" ? ("critica" as const) : ("alta" as const),
          systemName: "NASAUTGC3",
          firedAt: new Date((l.time ?? 0) * 1000),
          metadata: { category: l.category, source: "nas" },
        }));

      // Also check storage volumes for degraded/crashed state
      const storageData = await this.apiGet("SYNO.Storage.CGI.Storage", 1, "load_info").catch(() => null);
      if (storageData?.success && storageData.data?.volumes) {
        for (const v of storageData.data.volumes) {
          if (v.status !== "normal") {
            alerts.push({
              externalId: `nas-vol-${v.volume_path ?? v.id}`,
              title: `Volumen NAS degradado: ${v.volume_path ?? v.id}`,
              severity: v.status === "crashed" ? ("critica" as const) : ("alta" as const),
              systemName: "NASAUTGC3",
              firedAt: new Date(),
              metadata: { volumeStatus: v.status, source: "nas" },
            });
          }
        }
      }

      return alerts;
    } catch (err: any) {
      logger.error({ err: err.message }, "NAS getAlerts failed");
      return [];
    }
  }

  async getSystems(): Promise<SystemStatus[]> {
    try {
      const sysData = await this.apiGet("SYNO.Core.System", 1, "info");
      if (!sysData.success) return [];

      const storageData = await this.apiGet("SYNO.Storage.CGI.Storage", 1, "load_info").catch(() => null);

      let volumeStatus: SystemStatus["status"] = "desconocido";
      let diskMetrics: { disk?: number } = {};

      if (storageData?.success && storageData.data?.volumes?.length > 0) {
        const allNormal = storageData.data.volumes.every((v: any) => v.status === "normal");
        const anyCrashed = storageData.data.volumes.some((v: any) => v.status === "crashed");
        volumeStatus = anyCrashed ? "critico" : allNormal ? "ok" : "degradado";

        // Estimate total disk usage across volumes
        const totalSize = storageData.data.volumes.reduce((acc: number, v: any) => acc + (v.size?.total ?? 0), 0);
        const usedSize = storageData.data.volumes.reduce((acc: number, v: any) => acc + (v.size?.used ?? 0), 0);
        if (totalSize > 0) {
          diskMetrics.disk = Math.round((usedSize / totalSize) * 100);
        }
      }

      return [
        {
          externalId: "nasautgc3",
          name: sysData.data?.hostname ?? "NASAUTGC3",
          type: "storage",
          status: volumeStatus,
          metrics: diskMetrics,
          metadata: {
            model: sysData.data?.model ?? "Synology",
            firmware: sysData.data?.firmware_ver ?? "unknown",
            source: "nas",
          },
        },
      ];
    } catch (err: any) {
      logger.error({ err: err.message }, "NAS getSystems failed");
      return [];
    }
  }
}
