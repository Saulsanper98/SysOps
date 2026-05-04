import { BaseConnector, type ConnectorHealth, type AlertSummary, type SystemStatus } from "../base";
import { dyn } from "../dynamicConnectorConfig";

/**
 * Conector Microsoft 365 / Intune (stub).
 * Expone salud y listas vacías hasta integrar Microsoft Graph (licencias, Intune, alertas Defender, etc.).
 */
export class M365Connector extends BaseConnector {
  readonly type = "m365";
  readonly displayName = "Microsoft 365 / Intune";

  async healthCheck(): Promise<ConnectorHealth> {
    const tenant = dyn.m365TenantId();
    if (!tenant) {
      return {
        healthy: false,
        error: "Configura tenantId en Ajustes → Conectores (m365) o variable M365_TENANT_ID.",
      };
    }
    return {
      healthy: false,
      error: `Tenant ${tenant}: integración Graph en desarrollo — sin llamadas aún.`,
      details: { tenantPreview: true },
    };
  }

  async getAlerts(): Promise<AlertSummary[]> {
    return [];
  }

  async getSystems(): Promise<SystemStatus[]> {
    return [];
  }
}
