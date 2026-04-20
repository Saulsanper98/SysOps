import { describe, it, expect } from "vitest";
import { MockConnector, mockAlerts, mockSystems } from "../connectors/mock";

describe("MockConnector", () => {
  const connector = new MockConnector("zabbix", "Zabbix");

  it("returns healthy status", async () => {
    const health = await connector.healthCheck();
    expect(health.healthy).toBe(true);
    expect(health.latencyMs).toBeGreaterThan(0);
  });

  it("returns alerts for its type", async () => {
    const alerts = await connector.getAlerts();
    expect(Array.isArray(alerts)).toBe(true);
    for (const a of alerts) {
      expect(a).toHaveProperty("externalId");
      expect(a).toHaveProperty("title");
      expect(a).toHaveProperty("severity");
      expect(["critica", "alta", "media", "baja", "info"]).toContain(a.severity);
    }
  });

  it("returns systems for its type", async () => {
    const systems = await connector.getSystems();
    expect(Array.isArray(systems)).toBe(true);
    for (const s of systems) {
      expect(s).toHaveProperty("externalId");
      expect(s).toHaveProperty("name");
      expect(["ok", "degradado", "critico", "desconocido"]).toContain(s.status);
    }
  });
});

describe("mockAlerts data", () => {
  it("has valid structure", () => {
    expect(mockAlerts.length).toBeGreaterThan(0);
    for (const a of mockAlerts) {
      expect(typeof a.externalId).toBe("string");
      expect(typeof a.title).toBe("string");
      expect(a.firedAt instanceof Date).toBe(true);
    }
  });
});

describe("mockSystems data", () => {
  it("has mix of statuses", () => {
    const statuses = new Set(mockSystems.map((s) => s.status));
    expect(statuses.has("ok")).toBe(true);
    expect(statuses.has("critico") || statuses.has("degradado")).toBe(true);
  });
});
