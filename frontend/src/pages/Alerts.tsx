import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, apiError } from "../lib/api";
import type { DashboardSummary, AlertSummary, DbAlert, Severity } from "../types";
import { Card, CardBody, CardHeader, CardTitle } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Dialog } from "../components/ui/Dialog";
import { SeverityDot } from "../components/ui/StatusDot";
import { EmptyState } from "../components/ui/EmptyState";
import { Bell, RefreshCw, AlertTriangle, LayoutGrid, Database, GitBranch, Unlink } from "lucide-react";
import { severityColor, severityLabel, timeAgo, cn } from "../lib/utils";
import toast from "react-hot-toast";

type TabMode = "resumen" | "persistidas";

function CorrelationDialog({ alert, onClose }: { alert: DbAlert; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: suggestions, isLoading } = useQuery<
    { id: string; title: string; status: string }[]
  >({
    queryKey: ["alert-correlation", alert.id],
    queryFn: () => api.get(`/alerts/${alert.id}/correlation-suggestions`).then((r) => r.data),
  });

  const linkIncident = useMutation({
    mutationFn: (incidentId: string) =>
      api.post(`/alerts/${alert.id}/link-incident`, { incidentId }).then((r) => r.data),
    onSuccess: () => {
      toast.success("Alerta vinculada a la incidencia");
      qc.invalidateQueries({ queryKey: ["alerts-db"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      onClose();
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <Dialog open={true} title="Correlación con incidencias" onClose={onClose} size="md">
      <p className="text-xs text-slate-500 mb-3 line-clamp-2">{alert.title}</p>
      {isLoading ? (
        <p className="text-sm text-slate-600 py-4 text-center">Cargando sugerencias…</p>
      ) : !suggestions?.length ? (
        <p className="text-sm text-slate-500">
          No hay incidencias abiertas sugeridas (mismo sistema o metadatos de ingest).
        </p>
      ) : (
        <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {suggestions.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-ops-600 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <Link to={`/incidents/${s.id}`} className="text-sm text-accent hover:underline line-clamp-2">
                  {s.title}
                </Link>
                <p className="text-[10px] text-slate-600 mt-0.5">{s.status}</p>
              </div>
              <Button size="sm" onClick={() => linkIncident.mutate(s.id)} loading={linkIncident.isPending}>
                Vincular
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

export default function Alerts() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabMode>("resumen");
  const [severityFilter, setSeverityFilter] = useState("");
  const [corrAlert, setCorrAlert] = useState<DbAlert | null>(null);

  const { data: summary, isLoading, isFetching } = useQuery<DashboardSummary>({
    queryKey: ["dashboard-summary"],
    queryFn: () => api.get("/dashboard/summary").then((r) => r.data),
    refetchInterval: tab === "resumen" ? 60000 : false,
    staleTime: 30000,
  });

  const { data: dbAlerts, isLoading: dbLoading, isFetching: dbFetching } = useQuery<DbAlert[]>({
    queryKey: ["alerts-db", severityFilter],
    queryFn: () =>
      api
        .get("/alerts", {
          params: {
            resolved: "false",
            limit: 100,
            ...(severityFilter ? { severity: severityFilter } : {}),
          },
        })
        .then((r) => r.data),
    enabled: tab === "persistidas",
    refetchInterval: tab === "persistidas" ? 45000 : false,
    staleTime: 20000,
  });

  const allAlerts: AlertSummary[] = summary?.alerts.topAlerts ?? [];
  const filteredSummary = severityFilter
    ? allAlerts.filter((a) => a.severity === severityFilter)
    : allAlerts;

  const groupedBySystem = useMemo(() => {
    const m = new Map<string, typeof filteredSummary>();
    for (const a of filteredSummary) {
      const k = a.systemName || "Sin sistema";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(a);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredSummary]);

  const groupedDb = useMemo(() => {
    const list = dbAlerts ?? [];
    const m = new Map<string, DbAlert[]>();
    for (const a of list) {
      const k = a.systemName || "Sin sistema";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(a);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [dbAlerts]);

  const severityCounts = allAlerts.reduce<Record<string, number>>((acc, a) => {
    acc[a.severity] = (acc[a.severity] ?? 0) + 1;
    return acc;
  }, {});

  const unlink = useMutation({
    mutationFn: (alertId: string) => api.delete(`/alerts/${alertId}/link-incident`).then((r) => r.data),
    onSuccess: () => {
      toast.success("Vínculo con incidencia eliminado");
      qc.invalidateQueries({ queryKey: ["alerts-db"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    qc.invalidateQueries({ queryKey: ["alerts-db"] });
  };

  const summaryLoading = tab === "resumen" && isLoading;
  const persistLoading = tab === "persistidas" && dbLoading;
  const fetching = (tab === "resumen" && isFetching) || (tab === "persistidas" && dbFetching);

  return (
    <div className="p-5 space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100">Alertas activas</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {tab === "resumen"
                ? `${allAlerts.length} en resumen del hub · ${summary?.alerts.critical ?? 0} críticas`
                : `${dbAlerts?.length ?? 0} persistidas en base de datos (webhook / ingest)`}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={<RefreshCw className={cn("w-3.5 h-3.5", fetching && "animate-spin")} />}
          onClick={handleRefresh}
        >
          Actualizar
        </Button>
      </div>

      <div className="flex rounded-lg border border-ops-600 p-0.5 bg-ops-850/90 w-fit" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "resumen"}
          onClick={() => setTab("resumen")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
            tab === "resumen" ? "bg-ops-700 text-slate-100 shadow-sm" : "text-slate-500 hover:text-slate-300",
          )}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          Resumen hub
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "persistidas"}
          onClick={() => setTab("persistidas")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
            tab === "persistidas" ? "bg-ops-700 text-slate-100 shadow-sm" : "text-slate-500 hover:text-slate-300",
          )}
        >
          <Database className="w-3.5 h-3.5" />
          Base de datos
        </button>
      </div>

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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tab === "resumen" ? "Top alertas (conectores)" : "Alertas abiertas (BD)"}</CardTitle>
          <span className="text-xs text-slate-500">
            {tab === "resumen" ? `${filteredSummary.length} resultados` : `${dbAlerts?.length ?? 0} resultados`}
          </span>
        </CardHeader>
        <CardBody className="p-0">
          {summaryLoading || persistLoading ? (
            <div className="py-12 text-center text-slate-600 text-sm animate-pulse">Cargando alertas...</div>
          ) : tab === "resumen" ? (
            filteredSummary.length === 0 ? (
              <EmptyState
                icon={<AlertTriangle className="w-7 h-7" />}
                title="Sin alertas activas"
                description="Todos los sistemas están funcionando correctamente."
              />
            ) : (
              <div className="divide-y divide-ops-700/50">
                {groupedBySystem.map(([sys, alerts]) => (
                  <div key={sys}>
                    <div className="px-4 py-2 bg-ops-850/80 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-ops-700">
                      {sys} · {alerts.length}
                    </div>
                    {alerts.map((alert) => (
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
                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-600 tabular-nums">
                            <span title={alert.firedAt}>{timeAgo(alert.firedAt)}</span>
                          </div>
                        </div>
                        <Badge className={cn("flex-shrink-0 mt-0.5", severityColor[alert.severity as Severity])}>
                          {severityLabel[alert.severity as Severity]}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )
          ) : !dbAlerts?.length ? (
            <EmptyState
              icon={<Database className="w-7 h-7" />}
              title="Sin alertas en base de datos"
              description="Las alertas ingestadas por webhook o conectores aparecerán aquí cuando estén persistidas."
            />
          ) : (
            <div className="divide-y divide-ops-700/50">
              {groupedDb.map(([sys, alerts]) => (
                <div key={sys}>
                  <div className="px-4 py-2 bg-ops-850/80 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-ops-700">
                    {sys} · {alerts.length}
                  </div>
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-ops-750 transition-colors"
                    >
                      <SeverityDot severity={alert.severity as Severity} className="mt-1.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200">{alert.title}</p>
                        {alert.description && (
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{alert.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[11px] text-slate-600">
                          <span className="font-mono">{alert.source}</span>
                          <span title={alert.firedAt}>{timeAgo(alert.firedAt)}</span>
                          {alert.incidentId && (
                            <Link
                              to={`/incidents/${alert.incidentId}`}
                              className="text-accent hover:underline"
                            >
                              Incidencia vinculada
                            </Link>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <Badge className={cn("text-xs", severityColor[alert.severity as Severity])}>
                          {severityLabel[alert.severity as Severity]}
                        </Badge>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[10px] px-1.5"
                            icon={<GitBranch className="w-3 h-3" />}
                            onClick={() => setCorrAlert(alert)}
                          >
                            Correlación
                          </Button>
                          {alert.incidentId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-[10px] px-1.5"
                              icon={<Unlink className="w-3 h-3" />}
                              loading={unlink.isPending}
                              onClick={() => unlink.mutate(alert.id)}
                            >
                              Quitar
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {corrAlert && <CorrelationDialog alert={corrAlert} onClose={() => setCorrAlert(null)} />}
    </div>
  );
}
