import { useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { DashboardSummary, SystemStatusItem } from "../types";
import { Card, CardHeader, CardTitle, CardBody } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { SeverityDot, StatusDot } from "../components/ui/StatusDot";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { Sparkline } from "../components/ui/Sparkline";
import {
  AlertTriangle, Server, CheckCircle, Activity,
  ArrowRight, RefreshCw, Database,
  Globe, Box, HardDrive, Clock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  severityColor, severityLabel,
  timeAgo, cn
} from "../lib/utils";
import { pseudoSeriesFromSeed } from "../lib/sparkline";
import { usePreferencesStore, DEFAULT_DASHBOARD_KPI_ORDER } from "../store/useStore";
import type { Severity, SystemStatus } from "../types";

const KPI_SPARK: Record<"red" | "orange" | "green" | "blue", string> = {
  red: "#f87171",
  orange: "#fbbf24",
  green: "#34d399",
  blue: "#60a5fa",
};

interface AuditEvent {
  id: string;
  action: string;
  entityType: string;
  entityName?: string;
  description: string;
  createdAt: string;
  user?: { displayName: string };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const dashboardKpiOrder = usePreferencesStore((st) => st.dashboardKpiOrder);
  const dashboardHiddenWidgets = usePreferencesStore((st) => st.dashboardHiddenWidgets);
  const hideDash = (id: string) => dashboardHiddenWidgets.includes(id);

  const { data: summary, isLoading, isFetching, isError, error } = useQuery<DashboardSummary>({
    queryKey: ["dashboard-summary"],
    queryFn: () => api.get("/dashboard/summary").then((r) => r.data),
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const { data: systems } = useQuery<SystemStatusItem[]>({
    queryKey: ["dashboard-systems"],
    queryFn: () => api.get("/dashboard/systems").then((r) => r.data),
    refetchInterval: 120000,
  });

  const { data: recentActivity } = useQuery<{ data: AuditEvent[] }>({
    queryKey: ["dashboard-activity"],
    queryFn: () => api.get("/audit", { params: { limit: 6, page: 1 } }).then((r) => r.data),
    staleTime: 60000,
    refetchInterval: 120000,
  });

  const kpiOrder = useMemo(() => {
    const base = [...DEFAULT_DASHBOARD_KPI_ORDER];
    const o = dashboardKpiOrder.length ? dashboardKpiOrder : base;
    return o.filter((id) => base.includes(id as (typeof base)[number]));
  }, [dashboardKpiOrder]);

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    qc.invalidateQueries({ queryKey: ["dashboard-systems"] });
  };

  if (isLoading) return <DashboardSkeleton />;

  if (!summary || isError) {
    return (
      <div className="p-5">
        <Card>
          <CardBody className="py-10 text-center">
            <p className="text-sm text-slate-300">No se pudo cargar el dashboard.</p>
            <p className="text-xs text-slate-500 mt-1">
              {(error as Error | undefined)?.message ?? "Respuesta de API incompleta"}
            </p>
            <div className="mt-4">
              <Button
                variant="ghost"
                size="sm"
                icon={<RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />}
                onClick={handleRefresh}
              >
                Reintentar
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  const s = summary;
  const criticalSystems = systems?.filter((sys) => sys.status === "critico") ?? [];
  const degradedSystems = systems?.filter((sys) => sys.status === "degradado") ?? [];

  const kpiById: Record<string, ReactNode> = {
    alerts: (
      <KpiCard
        key="alerts"
        label="Alertas activas"
        value={s.alerts.total}
        sub={`${s.alerts.critical} críticas`}
        icon={<AlertTriangle className="w-5 h-5" />}
        color={s.alerts.critical > 0 ? "red" : s.alerts.total > 5 ? "orange" : "green"}
        spark={
          <Sparkline
            values={pseudoSeriesFromSeed(`alerts-${s.alerts.total}-${s.alerts.critical}`)}
            color={KPI_SPARK[s.alerts.critical > 0 ? "red" : s.alerts.total > 5 ? "orange" : "green"]}
            height={22}
            className="max-w-[72px]"
          />
        }
        onClick={() => navigate("/incidents")}
      />
    ),
    systems: (
      <KpiCard
        key="systems"
        label="Sistemas"
        value={`${s.systems.healthPercent}%`}
        sub={`${s.systems.ok}/${s.systems.total} OK`}
        icon={<Server className="w-5 h-5" />}
        color={s.systems.critical > 0 ? "red" : s.systems.degraded > 0 ? "orange" : "green"}
        spark={
          <Sparkline
            values={pseudoSeriesFromSeed(`sys-${s.systems.healthPercent}-${s.systems.ok}`)}
            color={KPI_SPARK[s.systems.critical > 0 ? "red" : s.systems.degraded > 0 ? "orange" : "green"]}
            height={22}
            className="max-w-[72px]"
          />
        }
      />
    ),
    incidents: (
      <KpiCard
        key="incidents"
        label="Incidencias abiertas"
        value={s.incidents.open}
        sub={`${s.incidents.today} hoy${typeof s.incidents.slaBreaches === "number" ? ` · SLA ${s.incidents.slaBreaches} incumpl.` : ""}`}
        icon={<Activity className="w-5 h-5" />}
        color={(s.incidents.slaBreaches ?? 0) > 0 ? "red" : s.incidents.open > 3 ? "orange" : "green"}
        spark={
          <Sparkline
            values={pseudoSeriesFromSeed(`inc-${s.incidents.open}-${s.incidents.today}`)}
            color={KPI_SPARK[s.incidents.open > 3 ? "orange" : "green"]}
            height={22}
            className="max-w-[72px]"
          />
        }
        onClick={() =>
          navigate((s.incidents.slaBreaches ?? 0) > 0 ? "/incidents?slaRisk=breach" : "/incidents")
        }
      />
    ),
    connectors: (
      <KpiCard
        key="connectors"
        label="Conectores"
        value={`${s.connectors.healthy}/${s.connectors.total}`}
        sub="online"
        icon={<CheckCircle className="w-5 h-5" />}
        color={s.connectors.healthy < s.connectors.total ? "orange" : "green"}
        spark={
          <Sparkline
            values={pseudoSeriesFromSeed(`conn-${s.connectors.healthy}-${s.connectors.total}`)}
            color={KPI_SPARK[s.connectors.healthy < s.connectors.total ? "orange" : "green"]}
            height={22}
            className="max-w-[72px]"
          />
        }
      />
    ),
  };

  return (
    <div className="p-5 space-y-5 animate-fade-in">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Vista en tiempo real · {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {s.demoMode && (
            <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs rounded-full font-mono">
              MODO DEMO
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />}
            onClick={handleRefresh}
          >
            Actualizar
          </Button>
        </div>
      </div>

      {/* ─── KPI Row (orden desde preferencias) ─────────────────── */}
      {!hideDash("dashboard-kpis") && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpiOrder.map((id) => kpiById[id]).filter(Boolean)}
        </div>
      )}

      {/* ─── Main grid ───────────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-4">
        {/* Top Alerts */}
        {!hideDash("dashboard-top-alerts") && (
        <div className="col-span-12 lg:col-span-7">
          <Card>
            <CardHeader>
              <CardTitle>Top Alertas Activas</CardTitle>
              <Button variant="ghost" size="xs" onClick={() => navigate("/incidents")}>
                Ver todas <ArrowRight className="w-3 h-3" />
              </Button>
            </CardHeader>
            <CardBody className="p-0">
              {s.alerts.topAlerts.length === 0 ? (
                <div className="py-8 text-center text-slate-600 text-sm">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-500/30" />
                  Sin alertas activas
                </div>
              ) : (
                <div className="divide-y divide-ops-700">
                  {s.alerts.topAlerts.map((alert) => (
                    <div key={alert.externalId} className="flex items-start gap-3 px-4 py-3 hover:bg-ops-750 transition-colors">
                      <SeverityDot severity={alert.severity as Severity} className="mt-1.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200 truncate">{alert.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-slate-500">{alert.systemName}</span>
                          <span className="text-slate-700">·</span>
                          <span className="text-xs text-slate-600">{timeAgo(alert.firedAt)}</span>
                        </div>
                      </div>
                      <Badge className={severityColor[alert.severity as Severity]}>
                        {severityLabel[alert.severity as Severity]}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
        )}

        {/* Connector Status */}
        {!hideDash("dashboard-connectors") && (
        <div className="col-span-12 lg:col-span-5 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Estado Conectores</CardTitle>
            </CardHeader>
            <CardBody className="p-0">
              <div className="divide-y divide-ops-700">
                {s.connectors.list.map((c) => (
                  <div key={c.type} className="flex items-center gap-3 px-4 py-2.5">
                    <ConnectorIcon type={c.type} />
                    <span className="flex-1 text-sm text-slate-300">{c.displayName}</span>
                    {c.healthy ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600 font-mono">{c.latencyMs}ms</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-400 max-w-24 truncate">{c.error ?? "Error"}</span>
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
        )}
      </div>

      {/* ─── Degraded / Critical Systems ─────────────────────────── */}
      {!hideDash("dashboard-problems") && (criticalSystems.length > 0 || degradedSystems.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Sistemas con problemas</CardTitle>
            <span className="text-xs text-slate-500">
              {criticalSystems.length} críticos · {degradedSystems.length} degradados
            </span>
          </CardHeader>
          <CardBody className="p-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 divide-y sm:divide-y-0 divide-ops-700">
              {[...criticalSystems, ...degradedSystems].slice(0, 8).map((sys) => (
                <div key={sys.externalId} className="flex items-center gap-3 px-4 py-3 border-b border-ops-700/50">
                  <StatusDot status={sys.status as SystemStatus} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">{sys.name}</p>
                    <p className="text-xs text-slate-500 capitalize">{sys.type}</p>
                  </div>
                  {sys.metrics?.cpu !== undefined && (
                    <div className="text-right">
                      <p className={cn("text-xs font-mono", sys.metrics.cpu > 90 ? "text-red-400" : sys.metrics.cpu > 70 ? "text-amber-400" : "text-slate-500")}>
                        CPU {sys.metrics.cpu}%
                      </p>
                      {sys.metrics.memory !== undefined && (
                        <p className="text-xs font-mono text-slate-600">MEM {sys.metrics.memory}%</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* ─── All Systems Grid ────────────────────────────────────── */}
      {!hideDash("dashboard-all-systems") && systems && systems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Todos los Sistemas</CardTitle>
            <span className="text-xs text-slate-500">{systems.length} monitorizados</span>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
              {systems.map((sys) => (
                <SystemChip key={sys.externalId} system={sys} />
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* ─── Recent Activity ─────────────────────────────────────── */}
      {!hideDash("dashboard-activity") && (
        <Card>
          <CardHeader>
            <CardTitle>Actividad Reciente</CardTitle>
            <Button variant="ghost" size="xs" onClick={() => navigate("/audit")}>
              Ver todo <ArrowRight className="w-3 h-3" />
            </Button>
          </CardHeader>
          <CardBody className="p-0">
            {(recentActivity?.data?.length ?? 0) > 0 ? (
              <div className="divide-y divide-ops-700/50">
                {recentActivity!.data.map((event) => (
                  <div key={event.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-ops-750 transition-colors">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-300 truncate">{event.description}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-600">
                        {event.user && <span>{event.user.displayName}</span>}
                        <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{timeAgo(event.createdAt)}</span>
                      </div>
                    </div>
                    <span className="text-xs text-slate-700 capitalize flex-shrink-0">{event.entityType}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                className="py-10"
                icon={<Clock className="w-6 h-6" />}
                title="Sin actividad reciente"
                description="Cuando haya eventos de auditoría aparecerán aquí."
                action={{ label: "Ir a auditoría", onClick: () => navigate("/audit") }}
              />
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon, color, spark, onClick,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: ReactNode;
  color: "red" | "orange" | "green" | "blue";
  spark?: ReactNode;
  onClick?: () => void;
}) {
  const colors = {
    red: "text-red-400 bg-red-500/10",
    orange: "text-amber-400 bg-amber-500/10",
    green: "text-emerald-400 bg-emerald-500/10",
    blue: "text-blue-400 bg-blue-500/10",
  };

  return (
    <Card hover={!!onClick} onClick={onClick} className="p-4 flex items-center gap-4 min-h-[5.5rem]">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", colors[color])}>
        <span className={colors[color].split(" ")[0]}>{icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xl font-bold text-slate-100 leading-none">{value}</div>
        <div className="text-xs text-slate-400 mt-0.5">{label}</div>
        <div className="text-xs text-slate-600 mt-0.5">{sub}</div>
      </div>
      {spark && <div className="flex-shrink-0 self-end opacity-90 pointer-events-none">{spark}</div>}
    </Card>
  );
}

function ConnectorIcon({ type }: { type: string }) {
  const icons: Record<string, ReactNode> = {
    zabbix:      <Activity   className="w-4 h-4 text-red-400"     />,
    uptime_kuma: <Globe      className="w-4 h-4 text-emerald-400" />,
    proxmox:     <Server     className="w-4 h-4 text-orange-400"  />,
    vcenter:     <Server     className="w-4 h-4 text-blue-400"    />,
    portainer:   <Box        className="w-4 h-4 text-cyan-400"    />,
    nas:         <HardDrive  className="w-4 h-4 text-purple-400"  />,
    qnap:        <HardDrive  className="w-4 h-4 text-teal-400"    />,
    hikvision:   <Database   className="w-4 h-4 text-rose-400"    />,
    m365:        <Database   className="w-4 h-4 text-blue-400"    />,
  };
  return <span>{icons[type] ?? <Database className="w-4 h-4 text-slate-500" />}</span>;
}

function SystemChip({ system }: { system: SystemStatusItem }) {
  return (
    <div className={cn(
      "flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs",
      system.status === "critico"
        ? "bg-red-500/5 border-red-500/20"
        : system.status === "degradado"
        ? "bg-amber-500/5 border-amber-500/20"
        : "bg-ops-750 border-ops-600",
    )}>
      <StatusDot status={system.status as SystemStatus} />
      <span className="truncate text-slate-300">{system.name}</span>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="p-5 space-y-5">
      <Skeleton className="h-6 w-48" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg border border-ops-600" />
        ))}
      </div>
      <div className="grid grid-cols-12 gap-4">
        <Skeleton className="col-span-12 lg:col-span-7 h-64 rounded-lg border border-ops-600" />
        <Skeleton className="col-span-12 lg:col-span-5 h-64 rounded-lg border border-ops-600" />
      </div>
    </div>
  );
}
