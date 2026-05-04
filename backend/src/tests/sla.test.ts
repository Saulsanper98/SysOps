import { describe, it, expect } from "vitest";
import { computeSlaDeadlines, computeSlaRisk } from "../services/sla";

describe("SLA", () => {
  it("computeSlaDeadlines respeta severidad crítica", () => {
    const t0 = new Date("2026-01-01T12:00:00Z");
    const d = computeSlaDeadlines("critica", t0);
    expect(d.slaResponseDueAt.getTime()).toBe(t0.getTime() + 60 * 60_000);
    expect(d.slaResolutionDueAt.getTime()).toBe(t0.getTime() + 240 * 60_000);
  });

  it("computeSlaRisk detecta incumplimiento de respuesta", () => {
    const past = new Date(Date.now() - 3600_000);
    expect(
      computeSlaRisk({
        status: "abierta",
        firstResponseAt: null,
        slaResponseDueAt: past,
        slaResolutionDueAt: new Date(Date.now() + 86400_000),
      }),
    ).toBe("response_breach");
  });
});
