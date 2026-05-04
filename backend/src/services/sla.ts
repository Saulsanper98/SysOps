/** Minutos desde creación hasta vencimiento de primera respuesta */
const RESPONSE_MINUTES: Record<string, number> = {
  critica: 60,
  alta: 240,
  media: 480,
  baja: 1440,
  info: 2880,
};

/** Minutos hasta vencimiento de resolución (cierre / resuelta) */
const RESOLUTION_MINUTES: Record<string, number> = {
  critica: 240,
  alta: 1440,
  media: 4320,
  baja: 10080,
  info: 20160,
};

function addMinutes(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * 60_000);
}

export function computeSlaDeadlines(severity: string, createdAt: Date) {
  const s = String(severity);
  const rm = RESPONSE_MINUTES[s] ?? RESPONSE_MINUTES.media;
  const resm = RESOLUTION_MINUTES[s] ?? RESOLUTION_MINUTES.media;
  return {
    slaResponseDueAt: addMinutes(createdAt, rm),
    slaResolutionDueAt: addMinutes(createdAt, resm),
  };
}

const TERMINAL: string[] = ["resuelta", "cerrada"];

export type SlaRisk = "ok" | "warning" | "response_breach" | "resolution_breach";

export function computeSlaRisk(row: {
  status: string;
  firstResponseAt: Date | null;
  slaResponseDueAt: Date | null;
  slaResolutionDueAt: Date | null;
}, now = new Date()): SlaRisk {
  if (TERMINAL.includes(row.status)) return "ok";
  const t = now.getTime();

  const respBreached =
    !row.firstResponseAt &&
    row.slaResponseDueAt &&
    row.slaResponseDueAt.getTime() < t;
  if (respBreached) return "response_breach";

  const resBreached = row.slaResolutionDueAt && row.slaResolutionDueAt.getTime() < t;
  if (resBreached) return "resolution_breach";

  const warnMs = 60 * 60_000;
  if (
    !row.firstResponseAt &&
    row.slaResponseDueAt &&
    row.slaResponseDueAt.getTime() - t <= warnMs &&
    row.slaResponseDueAt.getTime() >= t
  ) {
    return "warning";
  }
  if (
    row.slaResolutionDueAt &&
    row.slaResolutionDueAt.getTime() - t <= warnMs &&
    row.slaResolutionDueAt.getTime() >= t
  ) {
    return "warning";
  }

  return "ok";
}
