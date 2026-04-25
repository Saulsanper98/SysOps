import { BaseConnector, type ConnectorHealth, type AlertSummary, type SystemStatus } from "../base";

export class MockConnector extends BaseConnector {
  readonly type: string;
  readonly displayName: string;

  constructor(type: string, displayName: string) {
    super();
    this.type = type;
    this.displayName = displayName;
  }

  async healthCheck(): Promise<ConnectorHealth> {
    await delay(50 + Math.random() * 100);
    return { healthy: true, latencyMs: Math.round(50 + Math.random() * 80) };
  }

  async getAlerts(): Promise<AlertSummary[]> {
    return mockAlerts.filter((a) => a.metadata?.source === this.type);
  }

  async getSystems(): Promise<SystemStatus[]> {
    return mockSystems.filter((s) => s.metadata?.source === this.type);
  }
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export const mockAlerts: AlertSummary[] = [
  {
    externalId: "zbx-001",
    title: "CPU alta en PROD-DB-01 (92%)",
    description: "CPU usage superó el umbral del 90% durante 5 minutos",
    severity: "alta",
    systemName: "PROD-DB-01",
    firedAt: new Date(Date.now() - 12 * 60 * 1000),
    metadata: { source: "zabbix", ack: false },
  },
  {
    externalId: "zbx-002",
    title: "Disco /var/log lleno al 95% en APP-SRV-02",
    description: "Espacio en disco crítico — limpiar logs urgente",
    severity: "critica",
    systemName: "APP-SRV-02",
    firedAt: new Date(Date.now() - 3 * 60 * 1000),
    metadata: { source: "zabbix", ack: false },
  },
  {
    externalId: "zbx-003",
    title: "Servicio nginx caído en WEB-01",
    description: "nginx no responde en puerto 80/443",
    severity: "critica",
    systemName: "WEB-01",
    firedAt: new Date(Date.now() - 1 * 60 * 1000),
    metadata: { source: "zabbix", ack: false },
  },
  {
    externalId: "uk-001",
    title: "Portal Intranet no responde",
    description: "HTTP 502 Bad Gateway",
    severity: "alta",
    systemName: "portal.empresa.local",
    firedAt: new Date(Date.now() - 8 * 60 * 1000),
    metadata: { source: "uptime_kuma", url: "https://portal.empresa.local" },
  },
  {
    externalId: "prx-001",
    title: "VM BACKUP-01 apagada",
    description: "La VM de backups no está en ejecución",
    severity: "media",
    systemName: "BACKUP-01",
    firedAt: new Date(Date.now() - 45 * 60 * 1000),
    metadata: { source: "proxmox" },
  },
  {
    externalId: "zbx-004",
    title: "Latencia elevada en switch core",
    description: "RTT > 50ms al switch de core",
    severity: "media",
    systemName: "SW-CORE-01",
    firedAt: new Date(Date.now() - 25 * 60 * 1000),
    metadata: { source: "zabbix", ack: true },
  },
  {
    externalId: "nas-001",
    title: "Volumen RAID degradado en NAS-01",
    description: "Disco 3 con errores — RAID5 en modo degradado",
    severity: "critica",
    systemName: "NAS-01",
    firedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    metadata: { source: "nas" },
  },
  {
    externalId: "hik-001",
    title: "Disco NVR con errores SMART (HDD-2)",
    description: "El almacenamiento del grabador reporta advertencia en unidad interna",
    severity: "alta",
    systemName: "NVR-EDIFICIO-A",
    firedAt: new Date(Date.now() - 35 * 60 * 1000),
    metadata: { source: "hikvision" },
  },
];

export const mockSystems: SystemStatus[] = [
  { externalId: "s1", name: "PROD-DB-01", type: "server", status: "degradado", metrics: { cpu: 92, memory: 78, disk: 55 }, metadata: { source: "zabbix", env: "produccion" } },
  { externalId: "s2", name: "PROD-DB-02", type: "server", status: "ok", metrics: { cpu: 34, memory: 61, disk: 40 }, metadata: { source: "zabbix", env: "produccion" } },
  { externalId: "s3", name: "APP-SRV-01", type: "server", status: "ok", metrics: { cpu: 22, memory: 45, disk: 60 }, metadata: { source: "zabbix", env: "produccion" } },
  { externalId: "s4", name: "APP-SRV-02", type: "server", status: "critico", metrics: { cpu: 55, memory: 72, disk: 95 }, metadata: { source: "zabbix", env: "produccion" } },
  { externalId: "s5", name: "WEB-01", type: "server", status: "critico", metrics: { cpu: 88, memory: 66, disk: 50 }, metadata: { source: "zabbix", env: "produccion" } },
  { externalId: "s6", name: "WEB-02", type: "server", status: "ok", metrics: { cpu: 25, memory: 40, disk: 48 }, metadata: { source: "zabbix", env: "produccion" } },
  { externalId: "s7", name: "DEV-SRV-01", type: "server", status: "ok", metrics: { cpu: 10, memory: 30, disk: 25 }, metadata: { source: "zabbix", env: "desarrollo" } },
  { externalId: "s8", name: "portal.empresa.local", type: "service", status: "critico", metadata: { source: "uptime_kuma" } },
  { externalId: "s9", name: "vpn.empresa.local", type: "service", status: "ok", metadata: { source: "uptime_kuma", uptime: 99.98 } },
  { externalId: "s10", name: "mail.empresa.local", type: "service", status: "ok", metadata: { source: "uptime_kuma", uptime: 99.99 } },
  { externalId: "s11", name: "VM-PROD-APP", type: "vm", status: "ok", metrics: { cpu: 35, memory: 55 }, metadata: { source: "proxmox" } },
  { externalId: "s12", name: "BACKUP-01", type: "vm", status: "degradado", metadata: { source: "proxmox" } },
  { externalId: "s13", name: "NAS-01", type: "storage", status: "degradado", metadata: { source: "nas" } },
  { externalId: "s14", name: "nginx-proxy", type: "container", status: "critico", metadata: { source: "portainer" } },
  { externalId: "s15", name: "redis-cache", type: "container", status: "ok", metadata: { source: "portainer" } },
  { externalId: "s16", name: "NVR-EDIFICIO-A", type: "nvr", status: "degradado", metadata: { source: "hikvision", model: "DS-7616NI-K2" } },
];
