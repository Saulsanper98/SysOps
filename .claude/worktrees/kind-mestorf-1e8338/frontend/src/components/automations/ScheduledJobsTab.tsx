import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, apiError } from "../../lib/api";
import type { ScheduledJob, AutomationAction, ActionParameter } from "../../types";
import { Card, CardHeader, CardTitle, CardBody } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Input } from "../ui/Input";
import {
  Plus, Trash2, ToggleLeft, ToggleRight, AlertTriangle,
  CheckCircle, XCircle, Clock
} from "lucide-react";
import { cn, timeAgo } from "../../lib/utils";
import toast from "react-hot-toast";

const CRON_EXAMPLES = [
  { label: "Cada minuto", value: "* * * * *" },
  { label: "Cada 5 minutos", value: "*/5 * * * *" },
  { label: "Cada hora", value: "0 * * * *" },
  { label: "Diario a medianoche", value: "0 0 * * *" },
  { label: "Lunes a viernes 8:00", value: "0 8 * * 1-5" },
  { label: "Domingos a las 3:00", value: "0 3 * * 0" },
];

const statusColor: Record<string, string> = {
  success: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  failed: "text-red-400 bg-red-500/10 border-red-500/30",
  running: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  pending: "text-slate-400 bg-slate-500/10 border-slate-500/30",
};

const initialForm = {
  name: "",
  actionId: "",
  cronExpression: "",
  parameters: {} as Record<string, string>,
};

export function ScheduledJobsTab() {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [selectedAction, setSelectedAction] = useState<AutomationAction | null>(null);

  const { data: jobs, isLoading } = useQuery<ScheduledJob[]>({
    queryKey: ["scheduled-jobs"],
    queryFn: () => api.get("/scheduled-jobs").then((r) => r.data),
    refetchInterval: 30000,
  });

  const { data: actions } = useQuery<AutomationAction[]>({
    queryKey: ["automation-actions"],
    queryFn: () => api.get("/automations/actions").then((r) => r.data),
  });

  const createJob = useMutation({
    mutationFn: (data: typeof form) =>
      api.post("/scheduled-jobs", {
        name: data.name,
        actionId: data.actionId,
        cronExpression: data.cronExpression,
        parameters: data.parameters,
      }),
    onSuccess: () => {
      toast.success("Job programado creado");
      qc.invalidateQueries({ queryKey: ["scheduled-jobs"] });
      setShowNew(false);
      setForm(initialForm);
      setSelectedAction(null);
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const toggleJob = useMutation({
    mutationFn: (id: string) => api.patch(`/scheduled-jobs/${id}/toggle`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduled-jobs"] });
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const deleteJob = useMutation({
    mutationFn: (id: string) => api.delete(`/scheduled-jobs/${id}`),
    onSuccess: () => {
      toast.success("Job eliminado");
      qc.invalidateQueries({ queryKey: ["scheduled-jobs"] });
      setDeleteId(null);
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const handleActionSelect = (actionId: string) => {
    const action = actions?.find((a) => a.id === actionId) ?? null;
    setSelectedAction(action);
    setForm((p) => ({ ...p, actionId, parameters: {} }));
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">{jobs?.length ?? 0} jobs programados</p>
          <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowNew(true)}>
            Nuevo job
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Jobs programados</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            {isLoading ? (
              <div className="py-10 text-center text-slate-600 text-sm">Cargando...</div>
            ) : !jobs?.length ? (
              <div className="py-12 text-center text-slate-600 text-sm">Sin jobs programados</div>
            ) : (
              <div className="divide-y divide-ops-700/50">
                {jobs.map((job) => (
                  <div key={job.id} className="flex items-center gap-4 px-4 py-3 hover:bg-ops-750 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-200">{job.name}</p>
                        {job.lastRunStatus && (
                          <Badge className={statusColor[job.lastRunStatus] ?? statusColor.pending}>
                            {job.lastRunStatus}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {job.action.name} · <span className="font-mono">{job.cronExpression}</span>
                      </p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {job.lastRun && (
                          <span className="text-xs text-slate-600 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Última: {timeAgo(job.lastRun)}
                          </span>
                        )}
                        {job.nextRun && (
                          <span className="text-xs text-slate-600">
                            Próxima: {timeAgo(job.nextRun)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleJob.mutate(job.id)}
                        className="flex items-center gap-1 text-xs transition-colors"
                        title={job.enabled ? "Desactivar" : "Activar"}
                      >
                        {job.enabled ? (
                          <><ToggleRight className="w-5 h-5 text-emerald-400" /><span className="text-emerald-400">ON</span></>
                        ) : (
                          <><ToggleLeft className="w-5 h-5 text-slate-500" /><span className="text-slate-500">OFF</span></>
                        )}
                      </button>
                      <button
                        onClick={() => setDeleteId(job.id)}
                        className="p-1.5 rounded hover:bg-ops-600 text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* New job modal */}
      {showNew && (
        <Dialog open title="Nuevo job programado" onClose={() => { setShowNew(false); setSelectedAction(null); setForm(initialForm); }} size="lg">
          <div className="space-y-4">
            <Input
              label="Nombre del job"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Reinicio diario de servicios"
            />

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Acción</label>
              <select
                value={form.actionId}
                onChange={(e) => handleActionSelect(e.target.value)}
                className="w-full bg-ops-850 border border-ops-600 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-accent"
              >
                <option value="">Seleccionar acción...</option>
                {(actions ?? []).map((a) => (
                  <option key={a.id} value={a.id} className="bg-ops-800">
                    [{a.category}] {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Input
                label="Expresión Cron"
                value={form.cronExpression}
                onChange={(e) => setForm((p) => ({ ...p, cronExpression: e.target.value }))}
                placeholder="0 * * * *"
              />
              <div className="flex flex-wrap gap-1.5">
                {CRON_EXAMPLES.map((ex) => (
                  <button
                    key={ex.value}
                    onClick={() => setForm((p) => ({ ...p, cronExpression: ex.value }))}
                    className={cn(
                      "text-xs px-2 py-1 rounded border transition-colors",
                      form.cronExpression === ex.value
                        ? "bg-accent/10 border-accent/30 text-accent"
                        : "bg-ops-700 border-ops-600 text-slate-400 hover:text-slate-200",
                    )}
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>

            {selectedAction && selectedAction.parameters.length > 0 && (
              <div className="space-y-3 p-3 bg-ops-750 rounded-lg border border-ops-600">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Parámetros</p>
                {selectedAction.parameters.map((param: ActionParameter) => (
                  <Input
                    key={param.name}
                    label={`${param.label}${param.required ? " *" : ""}`}
                    value={form.parameters[param.name] ?? (param.default as string) ?? ""}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, parameters: { ...p.parameters, [param.name]: e.target.value } }))
                    }
                    placeholder={param.placeholder}
                  />
                ))}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => { setShowNew(false); setSelectedAction(null); setForm(initialForm); }}>
                Cancelar
              </Button>
              <Button
                loading={createJob.isPending}
                disabled={!form.name || !form.actionId || !form.cronExpression}
                onClick={() => createJob.mutate(form)}
              >
                Crear job
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <Dialog open title="Eliminar job" onClose={() => setDeleteId(null)} size="sm">
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">Esta acción eliminará el job programado permanentemente.</p>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancelar</Button>
              <Button variant="danger" loading={deleteJob.isPending} onClick={() => deleteJob.mutate(deleteId)}>
                Eliminar
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}

// Reuse these icons without importing to avoid duplication
function _unused() {
  return <><CheckCircle /><XCircle /></>;
}
