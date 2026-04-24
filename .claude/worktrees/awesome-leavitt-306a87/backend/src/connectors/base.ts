export interface ConnectorHealth {
  healthy: boolean;
  latencyMs?: number;
  error?: string;
  details?: Record<string, unknown>;
}

export interface AlertSummary {
  externalId: string;
  title: string;
  description?: string;
  severity: "critica" | "alta" | "media" | "baja" | "info";
  systemName: string;
  firedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface SystemStatus {
  externalId: string;
  name: string;
  type: string;
  status: "ok" | "degradado" | "critico" | "desconocido";
  metrics?: {
    cpu?: number;
    memory?: number;
    disk?: number;
    uptime?: number;
  };
  metadata?: Record<string, unknown>;
}

export abstract class BaseConnector {
  abstract readonly type: string;
  abstract readonly displayName: string;

  abstract healthCheck(): Promise<ConnectorHealth>;
  abstract getAlerts(): Promise<AlertSummary[]>;
  abstract getSystems(): Promise<SystemStatus[]>;
}
