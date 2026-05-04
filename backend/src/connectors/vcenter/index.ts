import axios, { type AxiosInstance } from "axios";
import https from "https";
import { BaseConnector, type ConnectorHealth, type AlertSummary, type SystemStatus } from "../base";
import { dyn } from "../dynamicConnectorConfig";
import { logger } from "../../utils/logger";

export class VCenterConnector extends BaseConnector {
  readonly type = "vcenter";
  readonly displayName = "VMware vCenter";

  private sessionId: string | null = null;
  private sessionExpiry = 0;

  // Ignore self-signed certs (common in on-prem vCenter)
  private readonly httpsAgent = new https.Agent({ rejectUnauthorized: false });

  private httpInstance: AxiosInstance | null = null;
  private httpBaseKey = "";

  private get http(): AxiosInstance {
    const base = (dyn.vcenterUrl() ?? "").replace(/\/$/, "");
    if (!this.httpInstance || this.httpBaseKey !== base) {
      this.sessionId = null;
      this.sessionExpiry = 0;
      this.httpBaseKey = base;
      this.httpInstance = axios.create({
        baseURL: `${base}/api`,
        timeout: 12000,
        httpsAgent: this.httpsAgent,
      });
    }
    return this.httpInstance;
  }

  private async getSession(): Promise<string> {
    if (this.sessionId && Date.now() < this.sessionExpiry) return this.sessionId;

    const token = Buffer.from(
      `${dyn.vcenterUser()}:${dyn.vcenterPassword()}`,
    ).toString("base64");

    const base = (dyn.vcenterUrl() ?? "").replace(/\/$/, "");

    const { data } = await axios.post(
      `${base}/api/session`,
      null,
      {
        headers: { Authorization: `Basic ${token}` },
        httpsAgent: this.httpsAgent,
        timeout: 10000,
      },
    );

    // vSphere REST API returns the session ID as a plain JSON string (with quotes stripped by axios)
    const sid = typeof data === "string" ? data : (data?.value ?? String(data));
    this.sessionId = sid.replace(/^"|"$/g, ""); // strip stray quotes just in case
    this.sessionExpiry = Date.now() + 20 * 60 * 1000;

    this.http.defaults.headers.common["vmware-api-session-id"] = this.sessionId!;
    return this.sessionId!;
  }

  async healthCheck(): Promise<ConnectorHealth> {
    const start = Date.now();
    try {
      await this.getSession();
      const { data } = await this.http.get("/vcenter/datacenter");
      const dcCount = Array.isArray(data) ? data.length : 0;
      return {
        healthy: true,
        latencyMs: Date.now() - start,
        details: { datacenters: dcCount },
      };
    } catch (err: any) {
      return { healthy: false, error: err.message, latencyMs: Date.now() - start };
    }
  }

  async getAlerts(): Promise<AlertSummary[]> {
    try {
      const systems = await this.getSystems();
      return systems
        .filter((s) => s.status === "degradado")
        .map((s) => ({
          externalId: `vcenter-${s.externalId}`,
          title: `VM apagada: ${s.name}`,
          severity: "baja" as const,
          systemName: s.name,
          firedAt: new Date(),
          metadata: { ...s.metadata, source: "vcenter" },
        }));
    } catch (err: any) {
      logger.error({ err: err.message }, "vCenter getAlerts failed");
      return [];
    }
  }

  async getSystems(): Promise<SystemStatus[]> {
    try {
      await this.getSession();

      // Fetch all VMs (no filter — simpler, works across vSphere 6.7 / 7 / 8)
      const { data: vms } = await this.http.get("/vcenter/vm");

      return (vms ?? []).map((vm: any) => ({
        externalId: vm.vm,
        name: vm.name,
        type: "vm",
        status:
          vm.power_state === "POWERED_ON"
            ? "ok"
            : vm.power_state === "POWERED_OFF"
            ? "degradado"
            : "desconocido",
        metrics: {},
        metadata: {
          powerState: vm.power_state,
          source: "vcenter",
          cpuCount: vm.cpu_count,
          memorySizeMiB: vm.memory_size_MiB,
        },
      }));
    } catch (err: any) {
      logger.error({ err: err.message }, "vCenter getSystems failed");
      return [];
    }
  }
}
