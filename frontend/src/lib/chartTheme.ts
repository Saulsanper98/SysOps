/** Colores de series Recharts / métricas alineados con la paleta de la app */
export const CHART_COLORS = {
  alerts: "#ef4444",
  systemsOk: "#10b981",
  latency: "#3b82f6",
  grid: "#1a2540",
  tooltipBg: "#111827",
  tooltipBorder: "#1a2540",
  axisTick: "#475569",
} as const;

export const METRIC_TYPE_COLORS: Record<"alerts_count" | "systems_ok" | "latency_ms" | "incidents_open", string> = {
  alerts_count: CHART_COLORS.alerts,
  systems_ok: CHART_COLORS.systemsOk,
  latency_ms: CHART_COLORS.latency,
  incidents_open: "#a855f7",
};
