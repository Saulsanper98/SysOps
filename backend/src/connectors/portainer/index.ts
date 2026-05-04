import axios, { type AxiosInstance } from "axios";
import https from "https";
import { BaseConnector, type ConnectorHealth, type AlertSummary, type SystemStatus } from "../base";
import { dyn } from "../dynamicConnectorConfig";
import { logger } from "../../utils/logger";

export class PortainerConnector extends BaseConnector {
  readonly type = "portainer";
  readonly displayName = "Portainer";

  private jwtToken: string | null = null;
  private tokenExpiry = 0;
  private readonly httpsAgent = new https.Agent({ rejectUnauthorized: false });

  private get baseURL() {
    return (dyn.portainerUrl() ?? "").replace(/\/$/, "");
  }

  private get client(): AxiosInstance {
    return axios.create({
      baseURL: `${this.baseURL}/api`,
      timeout: 10000,
      httpsAgent: this.httpsAgent,
      headers: this.jwtToken
        ? { Authorization: `Bearer ${this.jwtToken}` }
        : dyn.portainerApiKey()
        ? { "X-API-Key": dyn.portainerApiKey()! }
        : {},
    });
  }

  private async getToken(): Promise<void> {
    if (this.jwtToken && Date.now() < this.tokenExpiry) return;

    // Prefer API key (stateless), fall back to user/pass JWT
    if (dyn.portainerApiKey()) {
      this.jwtToken = null; // uses X-API-Key header directly
      return;
    }

    if (!dyn.portainerUser() || !dyn.portainerPassword()) {
      throw new Error("Portainer: configure PORTAINER_API_KEY or PORTAINER_USER/PASSWORD");
    }

    const { data } = await axios.post(
      `${this.baseURL}/api/auth`,
      { username: dyn.portainerUser(), password: dyn.portainerPassword() },
      { timeout: 8000, httpsAgent: this.httpsAgent },
    );

    this.jwtToken = data.jwt;
    // Portainer JWT expires in 8h by default
    this.tokenExpiry = Date.now() + 7 * 60 * 60 * 1000;
  }

  async healthCheck(): Promise<ConnectorHealth> {
    const start = Date.now();
    try {
      await this.getToken();
      const { data } = await this.client.get("/status");
      return {
        healthy: true,
        latencyMs: Date.now() - start,
        details: { version: data.Version ?? "unknown" },
      };
    } catch (err: any) {
      return { healthy: false, error: err.message, latencyMs: Date.now() - start };
    }
  }

  async getAlerts(): Promise<AlertSummary[]> {
    const systems = await this.getSystems();
    return systems
      .filter((s) => s.status !== "ok" && s.status !== "desconocido")
      .map((s) => ({
        externalId: `portainer-${s.externalId}`,
        title: `Contenedor caído: ${s.name}`,
        severity: "media" as const,
        systemName: s.name,
        firedAt: new Date(),
        metadata: s.metadata,
      }));
  }

  async getSystems(): Promise<SystemStatus[]> {
    try {
      await this.getToken();
      const { data: endpoints } = await this.client.get("/endpoints");
      const results: SystemStatus[] = [];

      for (const ep of endpoints ?? []) {
        const { data: containers } = await this.client
          .get(`/endpoints/${ep.Id}/docker/containers/json?all=true`)
          .catch(() => ({ data: [] }));

        for (const c of containers ?? []) {
          const name = (c.Names?.[0] ?? c.Id).replace(/^\//, "");
          results.push({
            externalId: c.Id.substring(0, 12),
            name,
            type: "container",
            status:
              c.State === "running"
                ? "ok"
                : c.State === "exited"
                ? "degradado"
                : c.State === "paused"
                ? "degradado"
                : "desconocido",
            metadata: {
              image: c.Image,
              endpoint: ep.Name,
              state: c.State,
              status: c.Status,
              source: "portainer",
            },
          });
        }
      }
      return results;
    } catch (err: any) {
      logger.error({ err: err.message }, "Portainer getSystems failed");
      return [];
    }
  }
}
