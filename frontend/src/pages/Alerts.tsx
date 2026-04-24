import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { DashboardSummary, AlertSummary } from "../types";
import { Card, CardBody, CardHeader, CardTitle } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { SeverityDot } from "../components/ui/StatusDot";
import { EmptyState } from "../components/ui/EmptyState";
import { Bell, RefreshCw, AlertTriangle } from "lucide-react";
import { severityColor, severityLabel, timeAgo, cn } from "../lib/utils";
import type { Severity } from "../types";

const severityOptions = [
  { value: "", label: "Todas las severidades" },
  { value: "critica", label: "Crítica" },
  { value: "alta", label: "Alta" },
  { value: "media", label: "Media" },
  { value: "baja", label: "Baja" },
  { value: "info", label: "Info" },
];

export default function Alerts() {
  const qc = useQueryClient();
  const [severityFilter, setSeverityFilter] = useState("");

  const { data: summary, isLoading, isFetching } = useQuery<DashboardSummary>({
    queryKey: ["dashboard-summary"],
    queryFn: () => api.get("/dashboard/summary").then((r) => r.data),
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const allAlerts: AlertSummary[] = summary?.alerts.topAlerts ?? [];
  const filtered = severityFilter
    ? allAlerts.filter((a) => a.severity === severityFilter)
    : allAlerts;

  const severityCounts = allAlerts.reduce<Record<string, number>>((acc, a) => {
    acc[a.severity] = (acc[a.severity] ?? 0) + 1;
    return acc;
  }, {});

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
  };

  return (
    <div className="p-5 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100">Alertas activas</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {allAlerts.length} alertas · {summary?.alerts.critical ?? 0} críticas
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={<RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />}
          onClick={handleRefresh}
        >
          Actualizar
        </Button>
      </div>

      {/* Severity chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["critica", "alta", "media", "baja", "info"] as Severity[]).map((s) => (
          <button
            key={s}
            onClick={() => setSeverityFilter((prev) => (prev === s ? "" : s))}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors",
              severityFilter === s
                ? severityColor[s]
                : "text-slate-500 bg-ops-800 border-ops-600 hover:border-ops-500",
            )}
          >
            <span>{severityLabel[s]}</span>
            <span className="font-mono">{severityCounts[s] ?? 0}</span>
          </button>
        ))}
        <div className="ml-auto">
          <Select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            options={severityOptions}
          />
        </div>
      </div>

      {/* Alerts list */}
      <Card>
        <CardHeader>
          <CardTitle>Todas las alertas</CardTitle>
          <span className="text-xs text-slate-500">{filtered.length} resultados</span>
        </CardHeader>
        <CardBody className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-slate-600 text-sm animate-pulse">Cargando alertas...</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<AlertTriangle className="w-7 h-7" />}
              title="Sin alertas activas"
              description="Todos los sistemas están funcionando correctamente."
            />
          ) : (
            <div className="divide-y divide-ops-700/50">
              {filtered.map((alert) => (
                <div
                  key={alert.externalId}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-ops-750 transition-colors"
                >
                  <SeverityDot severity={alert.severity as Severity} className="mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">{alert.title}</p>
                    {alert.description && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{alert.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-600">
                      <span className="font-medium text-slate-500">{alert.systemName}</span>
                      <span>·</span>
                      <span>{timeAgo(alert.firedAt)}</span>
                    </div>
                  </div>
                  <Badge className={cn("flex-shrink-0 mt-0.5", severityColor[alert.severity as Severity])}>
                    {severityLabel[alert.severity as Severity]}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
