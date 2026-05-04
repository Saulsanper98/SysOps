import axios from "axios";
import crypto from "crypto";
import https from "https";
import { BaseConnector, type ConnectorHealth, type AlertSummary, type SystemStatus } from "../base";
import { dyn } from "../dynamicConnectorConfig";
import { logger } from "../../utils/logger";

// ─── HTTP Digest auth helper ──────────────────────────────────────────────────
function buildDigestAuth(
  username: string,
  password: string,
  method: string,
  path: string,
  wwwAuth: string,
): string {
  const md5 = (s: string) => crypto.createHash("md5").update(s).digest("hex");

  const realm  = wwwAuth.match(/realm="([^"]+)"/)?.[1]    ?? "";
  const nonce  = wwwAuth.match(/nonce="([^"]+)"/)?.[1]    ?? "";
  const qop    = wwwAuth.match(/qop="?([^",\s]+)"?/)?.[1];
  const opaque = wwwAuth.match(/opaque="([^"]+)"/)?.[1];

  const ha1 = md5(`${username}:${realm}:${password}`);
  const ha2 = md5(`${method.toUpperCase()}:${path}`);

  let response: string;
  let ncPart = "";

  if (qop === "auth" || qop === "auth-int") {
    const nc     = "00000001";
    const cnonce = crypto.randomBytes(4).toString("hex");
    response = md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
    ncPart = `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
  } else {
    response = md5(`${ha1}:${nonce}:${ha2}`);
  }

  let header =
    `Digest username="${username}", realm="${realm}", nonce="${nonce}", ` +
    `uri="${path}", response="${response}"${ncPart}`;
  if (opaque) header += `, opaque="${opaque}"`;
  return header;
}

// ─── Connector ────────────────────────────────────────────────────────────────
export class HikvisionConnector extends BaseConnector {
  readonly type = "hikvision";
  readonly displayName = "Hikvision NVR";

  private readonly httpsAgent = new https.Agent({ rejectUnauthorized: false });

  private get baseURL() {
    return (dyn.hikvisionUrl() ?? "").replace(/\/$/, "");
  }

  private get credentials() {
    return {
      username: dyn.hikvisionUser() ?? "admin",
      password: dyn.hikvisionPassword() ?? "",
    };
  }

  // Two-step Digest: first request gets 401 + WWW-Authenticate, second carries auth
  private async digestGet(path: string): Promise<unknown> {
    const url = `${this.baseURL}${path}`;
    const { username, password } = this.credentials;

    // Step 1 — get the Digest challenge
    const challenge = await axios.get(url, {
      httpsAgent: this.httpsAgent,
      timeout: 8000,
      headers: { Accept: "application/json" },
      validateStatus: () => true,
    });

    if (challenge.status === 200) return challenge.data;

    if (challenge.status !== 401) {
      throw new Error(`Hikvision responded with HTTP ${challenge.status}`);
    }

    const wwwAuth = (challenge.headers["www-authenticate"] as string) ?? "";
    if (!wwwAuth.toLowerCase().startsWith("digest")) {
      throw new Error("Hikvision: expected Digest auth challenge");
    }

    // Step 2 — authenticated request
    const authHeader = buildDigestAuth(username, password, "GET", path, wwwAuth);
    const { data } = await axios.get(url, {
      httpsAgent: this.httpsAgent,
      timeout: 8000,
      headers: {
        Accept: "application/json",
        Authorization: authHeader,
      },
    });

    return data;
  }

  // ─── BaseConnector implementation ──────────────────────────────────────────

  async healthCheck(): Promise<ConnectorHealth> {
    const start = Date.now();
    try {
      const data = await this.digestGet("/ISAPI/System/deviceInfo") as any;
      // Firmware may wrap in DeviceInfo key or return flat
      const info = data?.DeviceInfo ?? data;
      return {
        healthy: true,
        latencyMs: Date.now() - start,
        details: {
          model:    info?.deviceName    ?? info?.model    ?? "Hikvision",
          firmware: info?.firmwareVersion ?? info?.deviceVersion ?? "unknown",
          serial:   info?.serialNumber   ?? "unknown",
        },
      };
    } catch (err: any) {
      return { healthy: false, error: err.message, latencyMs: Date.now() - start };
    }
  }

  async getAlerts(): Promise<AlertSummary[]> {
    const alerts: AlertSummary[] = [];
    try {
      // Check HDD health — degraded disks are actionable alerts
      const storage = await this.digestGet("/ISAPI/ContentMgmt/Storage").catch(() => null) as any;
      const hddRaw = storage?.storage?.hddList?.hdd ?? storage?.hddList?.hdd ?? [];
      const hdds: any[] = Array.isArray(hddRaw) ? hddRaw : hddRaw ? [hddRaw] : [];

      for (const hdd of hdds) {
        const st = (hdd.status ?? "").toLowerCase();
        if (st && st !== "ok" && st !== "normal") {
          alerts.push({
            externalId: `hikvision-hdd-${hdd.id ?? Math.random()}`,
            title: `Disco NVR con estado anómalo: ${hdd.hddName ?? `HDD ${hdd.id}`} (${hdd.status})`,
            severity: st === "abnormal" || st === "error" ? "alta" : "media",
            systemName: this.displayName,
            firedAt: new Date(),
            metadata: { hddId: hdd.id, status: hdd.status, capacity: hdd.capacity, source: "hikvision" },
          });
        }
      }
    } catch (err: any) {
      logger.error({ err: err.message }, "Hikvision getAlerts failed");
    }
    return alerts;
  }

  async getSystems(): Promise<SystemStatus[]> {
    try {
      const data = await this.digestGet("/ISAPI/System/deviceInfo") as any;
      const info = data?.DeviceInfo ?? data;

      // Optionally get video channel count
      let channelCount: number | undefined;
      try {
        const chData = await this.digestGet("/ISAPI/System/Video/inputs/channels") as any;
        const chList = chData?.VideoInputChannelList?.VideoInputChannel ?? [];
        channelCount = Array.isArray(chList) ? chList.length : chList ? 1 : undefined;
      } catch {
        // optional — proceed without it
      }

      return [
        {
          externalId: info?.serialNumber ?? info?.deviceID ?? "hikvision-nvr",
          name: info?.deviceName ?? "Hikvision NVR",
          type: "nvr",
          status: "ok",
          metadata: {
            model:    info?.deviceName     ?? "Hikvision",
            firmware: info?.firmwareVersion ?? "unknown",
            channels: channelCount,
            source:   "hikvision",
          },
        },
      ];
    } catch (err: any) {
      logger.error({ err: err.message }, "Hikvision getSystems failed");
      return [];
    }
  }
}
