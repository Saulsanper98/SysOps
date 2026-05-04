import axios from "axios";
import https from "https";
import { BaseConnector, type ConnectorHealth, type AlertSummary, type SystemStatus } from "../base";
import { dyn } from "../dynamicConnectorConfig";
import { logger } from "../../utils/logger";

// QNAP QTS API implementation
// Tries QTS v2 REST API first, then falls back to legacy CGI login
export class QnapConnector extends BaseConnector {
  readonly type = "qnap";
  readonly displayName = "QNAP NAS";

  private authSid: string | null = null;
  private sidExpiry = 0;

  // QNAP often uses self-signed certificates
  private readonly httpsAgent = new https.Agent({ rejectUnauthorized: false });

  private get baseURL() {
    return (dyn.qnapUrl() ?? "").replace(/\/$/, "");
  }

  private async login(): Promise<string> {
    if (this.authSid && Date.now() < this.sidExpiry) return this.authSid;

    const user = dyn.qnapUser() ?? "admin";
    const password = dyn.qnapPassword() ?? "";

    // Try QTS v2 REST API first
    try {
      const { data } = await axios.post(
        `${this.baseURL}/api/v1/login`,
        { username: user, password },
        { httpsAgent: this.httpsAgent, timeout: 8000 },
      );
      if (data?.authSid) {
        this.authSid = data.authSid;
        this.sidExpiry = Date.now() + 30 * 60 * 1000;
        return this.authSid!;
      }
    } catch {
      // Fall through to legacy API
    }

    // Legacy CGI login: base64 encoded password
    const b64pwd = Buffer.from(password).toString("base64");
    const { data } = await axios.get(
      `${this.baseURL}/cgi-bin/filemanager/utilRequest.cgi`,
      {
        params: { func: "login", user, pwd: b64pwd },
        httpsAgent: this.httpsAgent,
        timeout: 8000,
      },
    );

    // Legacy response has authSid or sid in various formats
    const sid = data?.authSid ?? data?.sid ?? data?.data?.sid;
    if (!sid) {
      throw new Error(`QNAP login failed: ${JSON.stringify(data)}`);
    }

    this.authSid = sid;
    this.sidExpiry = Date.now() + 30 * 60 * 1000;
    return this.authSid!;
  }

  private async apiGet(path: string, params: Record<string, unknown> = {}) {
    const sid = await this.login();
    const { data } = await axios.get(`${this.baseURL}${path}`, {
      params: { ...params, sid },
      httpsAgent: this.httpsAgent,
      timeout: 8000,
    });
    return data;
  }

  async healthCheck(): Promise<ConnectorHealth> {
    const start = Date.now();
    try {
      await this.login();
      const data = await this.apiGet("/api/v1/sys/sysrequest/sysinfo").catch(() =>
        this.apiGet("/cgi-bin/management/manaRequest.cgi", { subfunc: "sysinfo" }),
      );

      return {
        healthy: true,
        latencyMs: Date.now() - start,
        details: {
          model: data?.data?.model ?? data?.model ?? "QNAP",
          firmware: data?.data?.firmware ?? data?.firmware_version ?? "unknown",
          hostname: data?.data?.hostname ?? data?.hostname ?? "QNAP NAS",
        },
      };
    } catch (err: any) {
      return { healthy: false, error: err.message, latencyMs: Date.now() - start };
    }
  }

  async getAlerts(): Promise<AlertSummary[]> {
    try {
      const data = await this.apiGet("/api/v1/notificationcenter/messages").catch(() => null);
      if (!data) return [];

      const messages: any[] = data?.data?.messages ?? data?.messages ?? [];
      return messages
        .filter((m: any) => m.type === "error" || m.type === "warning")
        .map((m: any) => ({
          externalId: `qnap-${m.id ?? Math.random()}`,
          title: m.title ?? m.message ?? "QNAP Alert",
          severity: m.type === "error" ? ("alta" as const) : ("media" as const),
          systemName: this.displayName,
          firedAt: m.created_at ? new Date(m.created_at * 1000) : new Date(),
          metadata: { source: "qnap", category: m.category },
        }));
    } catch (err: any) {
      logger.error({ err: err.message }, "QNAP getAlerts failed");
      return [];
    }
  }

  async getSystems(): Promise<SystemStatus[]> {
    try {
      const data = await this.apiGet("/api/v1/sys/sysrequest/sysinfo").catch(() =>
        this.apiGet("/api/v1/storage/storages/disks"),
      );

      // Determine health from disk data
      let storageStatus: SystemStatus["status"] = "desconocido";

      const diskData = await this.apiGet("/api/v1/storage/storages/disks").catch(() => null);
      if (diskData) {
        const disks: any[] = diskData?.data?.disks ?? [];
        const hasError = disks.some((d: any) => d.status !== "ready" && d.status !== "");
        storageStatus = hasError ? "degradado" : "ok";
      }

      return [
        {
          externalId: "qnap-nas",
          name: data?.data?.hostname ?? data?.hostname ?? "QNAP NAS",
          type: "storage",
          status: storageStatus,
          metrics: {},
          metadata: {
            model: data?.data?.model ?? "QNAP",
            source: "qnap",
          },
        },
      ];
    } catch (err: any) {
      logger.error({ err: err.message }, "QNAP getSystems failed");
      return [];
    }
  }
}
