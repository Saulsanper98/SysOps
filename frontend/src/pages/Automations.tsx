import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, apiError } from "../lib/api";
import type { AutomationAction, AutomationRun } from "../types";
import { Card, CardHeader, CardTitle, CardBody } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Dialog } from "../components/ui/Dialog";
import { Input } from "../components/ui/Input";
import {
  Zap, Play, Clock, CheckCircle, XCircle, Loader2,
  Activity, RefreshCw, Trash2, Camera, Shield, Wifi,
  AlertTriangle, CalendarClock
} from "lucide-react";
import { automationStatusColor, timeAgo, cn } from "../lib/utils";
import type { AutomationStatus, ActionParameter } from "../types";
import toast from "react-hot-toast";
import { ScheduledJobsTab } from "../components/automations/ScheduledJobsTab";

const categoryIcons: Record<string, React.ReactNode> = {
  "health-check": <Activity className="w-4 h-4" />,
  restart: <RefreshCw className="w-4 h-4" />,
  cleanup: <Trash2 className="w-4 h-4" />,
  snapshot: <Camera className="w-4 h-4" />,
  validate: <Shield className="w-4 h-4" />,
};

const categoryColors: Record<string, string> = {
  "health-check": "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  restart: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  cleanup: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  snapshot: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  validate: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
};

export default function Automations() {
  const qc = useQueryClient();
  const [executing, setExecuting] = useState<AutomationAction | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [runOutput, setRunOutput] = useState<{ runId: string; open: boolean }>({ runId: "", open: false });
  const [activeTab, setActiveTab] = useState<"catalog" | "history" | "scheduled">("catalog");

  const { data: actions } = useQuery<AutomationAction[]>({
    queryKey: ["automation-actions"],
    queryFn: () => api.get("/automations/actions").then((r) => r.data),
  });

  const { data: runs, refetch: refetchRuns } = useQuery<AutomationRun[]>({
    queryKey: ["automation-runs"],
    queryFn: () => api.get("/automations/runs").then((r) => r.data),
    refetchInterval: 5000,
  });

  const { data: runDetail, refetch: refetchRunDetail } = useQuery<AutomationRun>({
    queryKey: ["automation-run", runOutput.runId],
    queryFn: () => api.get(`/automations/runs/${runOutput.runId}`).then((r) => r.data),
    enabled: runOutput.open && !!runOutput.runId,
    refetchInterval: (query) => {
      const d = query.state.data as AutomationRun | undefined;
      return d?.status === "ejecutando" || d?.status === "pendiente" ? 2000 : false;
    },
  });

  const executeAction = useMutation({
    mutationFn: ({ actionId, parameters }: { actionId: string; parameters: Record<string, string> }) =>
      api.post(`/automations/actions/${actionId}/run`, { parameters }),
    onSuccess: (res) => {
      toast.success("Ejecutando acción...");
      setExecuting(null);
      setParams({});
      setRunOutput({ runId: res.data.runId, open: true });
      qc.invalidateQueries({ queryKey: ["automation-runs"] });
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const grouped = (actions ?? []).reduce<Record<string, AutomationAction[]>>((acc, a) => {
    (acc[a.category] = acc[a.category] ?? []).push(a);
    return acc;
  }, {});

  return (
    <div className="p-5 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Automatizaciones</h1>
          <p className="text-xs text-slate-500 mt-0.5">Catálogo de acciones · Historial de ejecuciones</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={activeTab === "catalog" ? "primary" : "ghost"}
            size="sm"
            icon={<Zap className="w-3.5 h-3.5" />}
            onClick={() => setActiveTab("catalog")}
          >
            Catálogo
          </Button>
          <Button
            variant={activeTab === "history" ? "primary" : "ghost"}
            size="sm"
            icon={<Clock className="w-3.5 h-3.5" />}
            onClick={() => setActiveTab("history")}
          >
            Historial
          </Button>
          <Button
            variant={activeTab === "scheduled" ? "primary" : "ghost"}
            size="sm"
            icon={<CalendarClock className="w-3.5 h-3.5" />}
            onClick={() => setActiveTab("scheduled")}
          >
            Programadas
          </Button>
        </div>
      </div>

      {/* Catalog */}
      {activeTab === "catalog" && (
        <div className="space-y-4">
          {Object.entries(grouped).map(([cat, catActions]) => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-2">
                <span className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", categoryColors[cat] ?? "text-slate-400 bg-ops-700 border-ops-600")}>
                  {categoryIcons[cat]}
                  {cat.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {catActions.map((action) => (
                  <Card key={action.id} hover className="flex flex-col">
                    <CardBody className="flex-1 p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-200">{action.name}</h3>
                          {action.description && (
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{action.description}</p>
                          )}
                        </div>
                        {action.dangerous && (
                          <div title="Acción peligrosa — requiere confirmación">
                            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-auto">
                        <span className="text-xs text-slate-600 capitalize">Rol: {action.requiredRole}</span>
                        <Button
                          size="xs"
                          variant="secondary"
                          icon={<Play className="w-3 h-3" />}
                          onClick={() => { setExecuting(action); setParams({}); }}
                        >
                          Ejecutar
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* History */}
      {activeTab === "history" && (
        <Card>
          <CardHeader>
            <CardTitle>Historial de Ejecuciones</CardTitle>
            <Button variant="ghost" size="xs" icon={<RefreshCw className="w-3 h-3" />} onClick={() => refetchRuns()}>
              Refrescar
            </Button>
          </CardHeader>
          <CardBody className="p-0">
            {!runs?.length ? (
              <div className="py-12 text-center text-slate-600 text-sm">Sin ejecuciones registradas</div>
            ) : (
              <div className="divide-y divide-ops-700/50">
                {runs.map((run) => (
                  <div
                    key={run.id}
                    onClick={() => setRunOutput({ runId: run.id, open: true })}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-ops-750 cursor-pointer transition-colors"
                  >
                    <RunStatusIcon status={run.status as AutomationStatus} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200">{run.action?.name ?? "Acción"}</p>
                      <p className="text-xs text-slate-500">
                        {run.triggeredBy?.displayName ?? "Sistema"} · {timeAgo(run.createdAt)}
                        {run.system && ` · ${run.system.name}`}
                      </p>
                    </div>
                    <Badge className={automationStatusColor[run.status as AutomationStatus]}>
                      {run.status}
                    </Badge>
                    {run.finishedAt && run.startedAt && (
                      <span className="text-xs text-slate-600 font-mono ml-1">
                        {Math.round((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)}s
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Scheduled jobs */}
      {activeTab === "scheduled" && <ScheduledJobsTab />}

      {/* Execute modal */}
      {executing && (
        <Dialog open title={`Ejecutar: ${executing.name}`} onClose={() => setExecuting(null)} size="md">
          <div className="space-y-4">
            {executing.description && (
              <p className="text-sm text-slate-400">{executing.description}</p>
            )}
            {executing.dangerous && (
              <div className="flex items-start gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300">Esta es una acción marcada como peligrosa. Revisa los parámetros antes de ejecutar.</p>
              </div>
            )}
            {(executing.parameters ?? []).map((param: ActionParameter) => (
              <Input
                key={param.name}
                label={`${param.label}${param.required ? " *" : ""}`}
                value={params[param.name] ?? (param.default as string) ?? ""}
                onChange={(e) => setParams((p) => ({ ...p, [param.name]: e.target.value }))}
                placeholder={param.placeholder}
                required={param.required}
              />
            ))}
            {executing.parameters.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">Esta acción no requiere parámetros.</p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setExecuting(null)}>Cancelar</Button>
              <Button
                icon={<Play className="w-4 h-4" />}
                loading={executeAction.isPending}
                onClick={() => executeAction.mutate({ actionId: executing.id, parameters: params })}
              >
                Ejecutar
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Run output modal */}
      {runOutput.open && (
        <Dialog open title="Salida de Ejecución" onClose={() => setRunOutput((r) => ({ ...r, open: false }))} size="lg">
          {!runDetail ? (
            <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-accent" /></div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <RunStatusIcon status={runDetail.status as AutomationStatus} />
                <span className="text-sm text-slate-300">{runDetail.action?.name}</span>
                <Badge className={automationStatusColor[runDetail.status as AutomationStatus]}>{runDetail.status}</Badge>
                {(runDetail.status === "pendiente" || runDetail.status === "ejecutando") && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                )}
                <button
                  onClick={() => refetchRunDetail()}
                  className="ml-auto p-1.5 rounded hover:bg-ops-700 text-slate-500 hover:text-slate-300 transition-colors"
                  title="Actualizar salida"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="bg-ops-950 rounded-lg border border-ops-700 p-3 font-mono text-xs text-slate-300 min-h-32 max-h-96 overflow-y-auto whitespace-pre-wrap">
                {runDetail.output ?? (runDetail.status === "pendiente" || runDetail.status === "ejecutando"
                  ? "⏳ Esperando salida..."
                  : "(sin salida)"
                )}
                {runDetail.error && (
                  <div className="mt-2 text-red-400">❌ Error: {runDetail.error}</div>
                )}
              </div>
            </div>
          )}
        </Dialog>
      )}
    </div>
  );
}

function RunStatusIcon({ status }: { status: AutomationStatus }) {
  const map = {
    completada: <CheckCircle className="w-4 h-4 text-emerald-400" />,
    fallida: <XCircle className="w-4 h-4 text-red-400" />,
    ejecutando: <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />,
    pendiente: <Clock className="w-4 h-4 text-slate-500" />,
    cancelada: <XCircle className="w-4 h-4 text-slate-500" />,
  };
  return map[status] ?? <Clock className="w-4 h-4 text-slate-500" />;
}
