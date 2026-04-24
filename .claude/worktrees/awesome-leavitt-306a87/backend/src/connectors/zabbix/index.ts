import axios, { type AxiosInstance } from "axios";
import { BaseConnector, type ConnectorHealth, type AlertSummary, type SystemStatus } from "../base";
import { config } from "../../config";
import { logger } from "../../utils/logger";

interface ZabbixResponse<T> {
  jsonrpc: string;
  result: T;
  id: number;
  error?: { code: number; message: string; data: string };
}

export class ZabbixConnector extends BaseConnector {
  readonly type = "zabbix";
  readonly displayName = "Zabbix";

  private client: AxiosInstance;
  private authToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    super();
    this.client = axios.create({
      baseURL: `${config.ZABBIX_URL}/api_jsonrpc.php`,
      timeout: 12000,
      headers: { "Content-Type": "application/json" },
    });
  }

  private async call<T>(method: string, params: unknown, requireAuth = true): Promise<T> {
    const body: Record<string, unknown> = {
      jsonrpc: "2.0",
      method,
      params,
      id: 1,
    };

    if (requireAuth) {
      body.auth = await this.getToken();
    }

    const { data } = await this.client.post<ZabbixResponse<T>>("", body);
    if (data.error) {
      throw new Error(`Zabbix API [${method}]: ${data.error.message} — ${data.error.data}`);
    }
    return data.result;
  }

  private async getToken(): Promise<string> {
    if (this.authToken && Date.now() < this.tokenExpiry) return this.authToken;

    // Zabbix 5.4+ uses "username", older versions use "user"
    let result: string | undefined;
    try {
      result = await this.call<string>(
        "user.login",
        { username: config.ZABBIX_USER, password: config.ZABBIX_PASSWORD },
        false,
      );
    } catch {
      // fallback for Zabbix < 5.4
      result = await this.call<string>(
        "user.login",
        { user: config.ZABBIX_USER, password: config.ZABBIX_PASSWORD },
        false,
      );
    }

    this.authToken = result!;
    this.tokenExpiry = Date.now() + 55 * 60 * 1000;
    return this.authToken;
  }

  async healthCheck(): Promise<ConnectorHealth> {
    const start = Date.now();
    try {
      const version = await this.call<string>("apiinfo.version", {}, false);
      await this.getToken();
      return { healthy: true, latencyMs: Date.now() - start, details: { version } };
    } catch (err: any) {
      return { healthy: false, error: err.message, latencyMs: Date.now() - start };
    }
  }

  async getAlerts(): Promise<AlertSummary[]> {
    try {
      // Zabbix 7.x: problem.get no longer supports selectHosts
      // We fetch problems + triggers separately to get hostnames
      const problems = await this.call<any[]>("problem.get", {
        output: ["eventid", "name", "severity", "clock", "acknowledged", "objectid"],
        sortfield: ["eventid"],
        sortorder: "DESC",
        limit: 100,
      });

      if (!problems.length) return [];

      // Get host info from triggers using objectids (triggerids)
      const triggerIds = [...new Set(problems.map((p) => p.objectid))];
      let triggerHostMap: Record<string, string> = {};

      try {
        const triggers = await this.call<any[]>("trigger.get", {
          output: ["triggerid"],
          triggerids: triggerIds,
          selectHosts: ["hostid", "name"],
        });
        for (const t of triggers) {
          triggerHostMap[t.triggerid] = t.hosts?.[0]?.name ?? "Desconocido";
        }
      } catch {
        // Host info optional — proceed without it
      }

      return problems.map((p) => ({
        externalId: p.eventid,
        title: p.name,
        severity: this.mapSeverity(p.severity),
        systemName: triggerHostMap[p.objectid] ?? "Zabbix",
        firedAt: new Date(Number(p.clock) * 1000),
        metadata: {
          acknowledged: p.acknowledged === "1",
          objectid: p.objectid,
          source: "zabbix",
        },
      }));
    } catch (err: any) {
      logger.error({ err: err.message }, "Zabbix getAlerts failed");
      return [];
    }
  }

  async getSystems(): Promise<SystemStatus[]> {
    try {
      const hosts = await this.call<any[]>("host.get", {
        output: ["hostid", "host", "name", "status", "available"],
        limit: 300,
      });

      return hosts.map((h) => ({
        externalId: h.hostid,
        name: h.name || h.host,
        type: "server",
        status: this.mapHostStatus(h.available, h.status),
        metadata: { source: "zabbix", available: h.available },
      }));
    } catch (err: any) {
      logger.error({ err: err.message }, "Zabbix getSystems failed");
      return [];
    }
  }

  private mapSeverity(z: string): AlertSummary["severity"] {
    const map: Record<string, AlertSummary["severity"]> = {
      "0": "info",
      "1": "info",
      "2": "baja",
      "3": "media",
      "4": "alta",
      "5": "critica",
    };
    return map[z] ?? "media";
  }

  private mapHostStatus(available: string, status: string): SystemStatus["status"] {
    if (status === "1") return "desconocido"; // host disabled
    if (available === "2") return "critico";  // unavailable
    if (available === "0") return "desconocido"; // unknown
    return "ok"; // available = 1
  }
}
