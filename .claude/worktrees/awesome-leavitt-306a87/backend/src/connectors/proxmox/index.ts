import axios from "axios";
import https from "https";
import { BaseConnector, type ConnectorHealth, type AlertSummary, type SystemStatus } from "../base";
import { config } from "../../config";
import { logger } from "../../utils/logger";

export class ProxmoxConnector extends BaseConnector {
  readonly type = "proxmox";
  readonly displayName = "Proxmox";

  private ticket: string | null = null;
  private csrfToken: string | null = null;
  private ticketExpiry = 0;

  private get client() {
    return axios.create({
      baseURL: `${config.PROXMOX_URL}/api2/json`,
      timeout: 10000,
      httpsAgent: new https.Agent({ rejectUnauthorized: config.PROXMOX_VERIFY_SSL }),
    });
  }

  private async auth(): Promise<{ ticket: string; csrf: string }> {
    if (this.ticket && Date.now() < this.ticketExpiry) {
      return { ticket: this.ticket, csrf: this.csrfToken! };
    }
    const { data } = await this.client.post("/access/ticket", null, {
      params: { username: config.PROXMOX_USER, password: config.PROXMOX_PASSWORD },
    });
    this.ticket = data.data.ticket;
    this.csrfToken = data.data.CSRFPreventionToken;
    this.ticketExpiry = Date.now() + 90 * 60 * 1000;
    return { ticket: this.ticket!, csrf: this.csrfToken! };
  }

  async healthCheck(): Promise<ConnectorHealth> {
    const start = Date.now();
    try {
      await this.auth();
      return { healthy: true, latencyMs: Date.now() - start };
    } catch (err: any) {
      return { healthy: false, error: err.message, latencyMs: Date.now() - start };
    }
  }

  async getAlerts(): Promise<AlertSummary[]> {
    // Proxmox doesn't have a native alerting concept; we surface VMs in error state
    try {
      const systems = await this.getSystems();
      return systems
        .filter((s) => s.status === "critico" || s.status === "degradado")
        .map((s) => ({
          externalId: `proxmox-${s.externalId}`,
          title: `VM/CT en estado ${s.status}: ${s.name}`,
          severity: s.status === "critico" ? "alta" : ("media" as any),
          systemName: s.name,
          firedAt: new Date(),
          metadata: s.metadata,
        }));
    } catch (err: any) {
      logger.error({ err }, "Proxmox getAlerts failed");
      return [];
    }
  }

  async getSystems(): Promise<SystemStatus[]> {
    try {
      const { ticket } = await this.auth();
      const { data: nodesData } = await this.client.get("/nodes", {
        headers: { Cookie: `PVEAuthCookie=${ticket}` },
      });

      const results: SystemStatus[] = [];
      for (const node of nodesData.data ?? []) {
        const { data: vmsData } = await this.client.get(`/nodes/${node.node}/qemu`, {
          headers: { Cookie: `PVEAuthCookie=${ticket}` },
        }).catch(() => ({ data: { data: [] } }));

        const { data: ctsData } = await this.client.get(`/nodes/${node.node}/lxc`, {
          headers: { Cookie: `PVEAuthCookie=${ticket}` },
        }).catch(() => ({ data: { data: [] } }));

        for (const vm of [...(vmsData.data ?? []), ...(ctsData.data ?? [])]) {
          results.push({
            externalId: `${node.node}/${vm.vmid}`,
            name: vm.name ?? `VM-${vm.vmid}`,
            type: vm.type === "lxc" ? "container" : "vm",
            status: vm.status === "running" ? "ok" : vm.status === "stopped" ? "degradado" : "desconocido",
            metrics: {
              cpu: vm.cpu ? Math.round(vm.cpu * 100) : undefined,
              memory: vm.maxmem ? Math.round((vm.mem / vm.maxmem) * 100) : undefined,
            },
            metadata: { node: node.node, vmid: vm.vmid },
          });
        }
      }
      return results;
    } catch (err: any) {
      logger.error({ err }, "Proxmox getSystems failed");
      return [];
    }
  }
}
