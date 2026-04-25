import axios from "axios";
import https from "https";
import { BaseConnector, type ConnectorHealth, type AlertSummary, type SystemStatus } from "../base";
import { config } from "../../config";
import { logger } from "../../utils/logger";

// Synology DSM 6/7 API implementation
export class NasConnector extends BaseConnector {
  readonly type = "nas";
  readonly displayName = "NAS/Almacenamiento";
  private static readonly FAST_TIMEOUT_MS = 2200;

  private sessions: Map<string, { sid: string; expiry: number }> = new Map();

  // Ignore self-signed certificates (common in Synology)
  private readonly httpsAgent = new https.Agent({ rejectUnauthorized: false });

  private get baseURLs() {
    const raw = (config.NAS_URL ?? "").trim();
    if (!raw) return [];
    return raw
      .split(",")
      .map((u) => u.trim().replace(/\/$/, ""))
      .filter(Boolean);
  }

  private hostOf(baseURL: string) {
    try {
      return new URL(baseURL).hostname;
    } catch {
      return baseURL;
    }
  }

  private async login(baseURL: string, timeoutMs = 8000): Promise<string> {
    const cached = this.sessions.get(baseURL);
    if (cached && Date.now() < cached.expiry) return cached.sid;

    const { data } = await axios.get(`${baseURL}/webapi/auth.cgi`, {
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
      timeout: timeoutMs,
    });

    if (!data.success) {
      throw new Error(`${this.hostOf(baseURL)} auth failed: ${JSON.stringify(data.error ?? data)}`);
    }

    const sid = data.data.sid as string;
    this.sessions.set(baseURL, { sid, expiry: Date.now() + 30 * 60 * 1000 });
    return sid;
  }

  private async apiGet(
    baseURL: string,
    api: string,
    version: number,
    method: string,
    extra: Record<string, unknown> = {},
    timeoutMs = 8000,
    authTimeoutMs = timeoutMs,
  ) {
    const sid = await this.login(baseURL, authTimeoutMs);
    const { data } = await axios.get(`${baseURL}/webapi/entry.cgi`, {
      params: { api, version, method, _sid: sid, ...extra },
      httpsAgent: this.httpsAgent,
      timeout: timeoutMs,
    });
    return data;
  }

  async healthCheck(): Promise<ConnectorHealth> {
    const start = Date.now();
    try {
      const baseURLs = this.baseURLs;
      if (!baseURLs.length) throw new Error("NAS_URL no configurada");

      // Keep health probe clearly under registry timeout (5000ms).
      const probeTimeoutMs = 2200;
      const probes = baseURLs.map(async (baseURL) => {
        const data = await this.apiGet(
          baseURL,
          "SYNO.Core.System",
          1,
          "info",
          {},
          probeTimeoutMs,
          probeTimeoutMs,
        );
        if (!data?.success) throw new Error("system info unsuccessful");
        return { host: this.hostOf(baseURL), data };
      });

      let firstOk: { host: string; data: any } | null = null;
      try {
        firstOk = await Promise.any(probes);
      } catch {
        firstOk = null;
      }

      if (!firstOk) throw new Error("Ningún NAS respondió correctamente");

      return {
        healthy: true,
        latencyMs: Date.now() - start,
        details: {
          model: firstOk.data?.data?.model ?? "unknown",
          firmware: firstOk.data?.data?.firmware_ver ?? "unknown",
          hostname: firstOk.data?.data?.hostname ?? firstOk.host,
          devices: 1,
          hosts: [firstOk.host],
        },
      };
    } catch (err: any) {
      return { healthy: false, error: err.message, latencyMs: Date.now() - start };
    }
  }

  async getAlerts(): Promise<AlertSummary[]> {
    try {
      const perHostAlerts = await Promise.allSettled(
        this.baseURLs.map(async (baseURL) => {
          const alerts: AlertSummary[] = [];
        const host = this.hostOf(baseURL);
          const [sysData, data, storageData] = await Promise.all([
            this.apiGet(baseURL, "SYNO.Core.System", 1, "info", {}, NasConnector.FAST_TIMEOUT_MS, NasConnector.FAST_TIMEOUT_MS).catch(
              () => null,
            ),
            this.apiGet(
              baseURL,
              "SYNO.Core.System.SystemLog",
              1,
              "list",
              { rows: 50 },
              NasConnector.FAST_TIMEOUT_MS,
              NasConnector.FAST_TIMEOUT_MS,
            ).catch(() => null),
            this.apiGet(
              baseURL,
              "SYNO.Storage.CGI.Storage",
              1,
              "load_info",
              {},
              NasConnector.FAST_TIMEOUT_MS,
              NasConnector.FAST_TIMEOUT_MS,
            ).catch(() => null),
          ]);
        const systemName = sysData?.data?.hostname ?? host;

        // System logs — errors only
        if (data?.success) {
          alerts.push(
            ...(data.data?.items ?? [])
              .filter((l: any) => l.type === "err" || l.type === "crit")
              .map((l: any) => ({
                externalId: `nas-log-${host}-${l.id ?? Math.random()}`,
                title: l.desc ?? "Error NAS",
                severity: l.type === "crit" ? ("critica" as const) : ("alta" as const),
                systemName,
                firedAt: new Date((l.time ?? 0) * 1000),
                metadata: { category: l.category, source: "nas", host },
              })),
          );
        }

        // Also check storage volumes for degraded/crashed state
        if (storageData?.success && storageData.data?.volumes) {
          for (const v of storageData.data.volumes) {
            if (v.status !== "normal") {
              alerts.push({
                externalId: `nas-vol-${host}-${v.volume_path ?? v.id}`,
                title: `Volumen NAS degradado: ${v.volume_path ?? v.id}`,
                severity: v.status === "crashed" ? ("critica" as const) : ("alta" as const),
                systemName,
                firedAt: new Date(),
                metadata: { volumeStatus: v.status, source: "nas", host },
              });
            }
          }
        }
          return alerts;
        }),
      );

      return perHostAlerts.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    } catch (err: any) {
      logger.error({ err: err.message }, "NAS getAlerts failed");
      return [];
    }
  }

  async getSystems(): Promise<SystemStatus[]> {
    try {
      const perHostSystems = await Promise.allSettled(
        this.baseURLs.map(async (baseURL) => {
          const host = this.hostOf(baseURL);
          const [sysData, storageData] = await Promise.all([
            this.apiGet(baseURL, "SYNO.Core.System", 1, "info", {}, NasConnector.FAST_TIMEOUT_MS, NasConnector.FAST_TIMEOUT_MS).catch(
              () => null,
            ),
            this.apiGet(
              baseURL,
              "SYNO.Storage.CGI.Storage",
              1,
              "load_info",
              {},
              NasConnector.FAST_TIMEOUT_MS,
              NasConnector.FAST_TIMEOUT_MS,
            ).catch(() => null),
          ]);
          if (!sysData?.success) return null;

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

          return {
          externalId: `nas-${host}`,
          name: sysData.data?.hostname ?? host,
          type: "storage",
          status: volumeStatus,
          metrics: diskMetrics,
          metadata: {
            model: sysData.data?.model ?? "Synology",
            firmware: sysData.data?.firmware_ver ?? "unknown",
            source: "nas",
            host,
          },
          } satisfies SystemStatus;
        }),
      );

      return perHostSystems.flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value] : []));
    } catch (err: any) {
      logger.error({ err: err.message }, "NAS getSystems failed");
      return [];
    }
  }
}
