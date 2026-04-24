import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Card, CardHeader, CardTitle, CardBody } from "../components/ui/Card";
import { Select } from "../components/ui/Select";
import { Button } from "../components/ui/Button";
import { RefreshCw, TrendingUp, Activity, Server, Bell } from "lucide-react";
import { cn } from "../lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

type MetricType = "alerts_count" | "systems_ok" | "latency_ms" | "incidents_open";
type Granularity = "15m" | "30m" | "1h" | "6h" | "1d";

interface MetricPoint { timestamp: string; value: number }
interface MetricResult {
  source: string;
  metricType: MetricType;
  data: MetricPoint[];
  stats: { min: number; max: number; avg: number; latest: number };
}

const metricOptions: { value: MetricType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: "alerts_count", label: "Alertas activas", icon: <Bell className="w-4 h-4" />, color: "#ef4444" },
  { value: "systems_ok", label: "Sistemas OK", icon: <Server className="w-4 h-4" />, color: "#10b981" },
  { value: "latency_ms", label: "Latencia (ms)", icon: <Activity className="w-4 h-4" />, color: "#3b82f6" },
];

const granularityOptions = [
  { value: "15m", label: "15 min" },
  { value: "30m", label: "30 min" },
  { value: "1h", label: "1 hora" },
  { value: "6h", label: "6 horas" },
  { value: "1d", label: "1 día" },
];

const fromOptions = [
  { value: "6", label: "Últimas 6h" },
  { value: "24", label: "Últimas 24h" },
  { value: "48", label: "Últimas 48h" },
  { value: "168", label: "Últimos 7d" },
];

function formatTs(ts: string, gran: Granularity): string {
  const d = new Date(ts);
  if (gran === "1d") return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function MetricChart({ type, color, granularity, fromHours }: {
  type: MetricType; color: string; granularity: Granularity; fromHours: number;
}) {
  const from = new Date(Date.now() - fromHours * 60 * 60 * 1000).toISOString();

  const { data, isLoading, refetch, isFetching } = useQuery<MetricResult>({
    queryKey: ["metrics", type, granularity, fromHours],
    queryFn: () =>
      api.get("/metrics/history", { params: { type, granularity, from, source: "all" } })
        .then((r) => r.data),
    staleTime: 60000,
    refetchInterval: 300000,
  });

  const points = data?.data ?? [];
  const stats = data?.stats;

  return (
    <div className="space-y-3">
      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Actual", val: stats.latest },
            { label: "Promedio", val: stats.avg },
            { label: "Mínimo", val: stats.min },
            { label: "Máximo", val: stats.max },
          ].map(({ label, val }) => (
            <div key={label} className="p-3 bg-ops-850 rounded-lg border border-ops-700">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-lg font-bold font-mono" style={{ color }}>{val}</p>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className="h-48 relative">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-sm animate-pulse">
            Cargando datos...
          </div>
        ) : points.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-sm">
            Sin datos para este período
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`grad-${type}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" vertical={false} />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(ts) => formatTs(ts, granularity)}
                tick={{ fill: "#475569", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                minTickGap={40}
              />
              <YAxis
                tick={{ fill: "#475569", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid #1a2540", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#94a3b8" }}
                itemStyle={{ color }}
                labelFormatter={(ts) => formatTs(String(ts), granularity)}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fill={`url(#grad-${type})`}
                dot={false}
                activeDot={{ r: 4, fill: color }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
        <button
          onClick={() => refetch()}
          className="absolute top-0 right-0 p-1 rounded hover:bg-ops-700 text-slate-600 hover:text-slate-400 transition-colors"
          title="Actualizar"
        >
          <RefreshCw className={cn("w-3 h-3", isFetching && "animate-spin")} />
        </button>
      </div>
    </div>
  );
}

export default function Metrics() {
  const [granularity, setGranularity] = useState<Granularity>("1h");
  const [fromHours, setFromHours] = useState("24");

  return (
    <div className="p-5 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Métricas</h1>
          <p className="text-xs text-slate-500 mt-0.5">Historial de rendimiento y estado del sistema</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-36">
            <Select
              value={fromHours}
              onChange={(e) => setFromHours(e.target.value)}
              options={fromOptions}
            />
          </div>
          <div className="w-32">
            <Select
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as Granularity)}
              options={granularityOptions}
            />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="space-y-4">
        {metricOptions.map(({ value, label, icon, color }) => (
          <Card key={value}>
            <CardHeader>
              <CardTitle>
                <span className="flex items-center gap-2" style={{ color }}>
                  {icon}
                  {label}
                </span>
              </CardTitle>
              <TrendingUp className="w-3.5 h-3.5 text-slate-600" />
            </CardHeader>
            <CardBody>
              <MetricChart
                type={value}
                color={color}
                granularity={granularity}
                fromHours={Number(fromHours)}
              />
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
