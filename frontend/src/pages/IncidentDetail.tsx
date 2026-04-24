import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, apiError } from "../lib/api";
import type { Incident, ChecklistItem, IncidentComment } from "../types";
import { Card, CardHeader, CardTitle, CardBody } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input, Textarea } from "../components/ui/Input";
import { Dialog } from "../components/ui/Dialog";
import { SeverityDot } from "../components/ui/StatusDot";
import {
  ArrowLeft, CheckSquare, Square, Clock,
  User, Zap, BookOpen, X, Check, AlertCircle, UserPlus,
  CheckCircle2, UserCheck, AlertTriangle as AlertIcon, Activity, Lock,
} from "lucide-react";
import { Breadcrumb } from "../components/ui/Breadcrumb";
import {
  severityColor, severityLabel, incidentStatusColor,
  incidentStatusLabel, timeAgo, formatDate, cn
} from "../lib/utils";
import type { Severity, IncidentStatus } from "../types";
import toast from "react-hot-toast";
import { useAuthStore } from "../store/useStore";

export default function IncidentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const [comment, setComment] = useState("");
  const [showClose, setShowClose] = useState(false);
  const [rca, setRca] = useState({ rootCause: "", resolution: "" });

  const { data: inc, isLoading } = useQuery<Incident>({
    queryKey: ["incident", id],
    queryFn: () => api.get(`/incidents/${id}`).then((r) => r.data),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["incident", id] });

  const toggleChecklist = useMutation({
    mutationFn: ({ itemId, completed }: { itemId: string; completed: boolean }) =>
      api.patch(`/incidents/${id}/checklist/${itemId}`, { completed }),
    onSuccess: invalidate,
  });

  const addComment = useMutation({
    mutationFn: () => api.post(`/incidents/${id}/comments`, { content: comment }),
    onSuccess: () => { toast.success("Comentario añadido"); setComment(""); invalidate(); },
    onError: (err) => toast.error(apiError(err)),
  });

  const assignToMe = useMutation({
    mutationFn: () => api.put(`/incidents/${id}`, { assignedTo: currentUser?.id }),
    onSuccess: () => { toast.success("Incidencia asignada"); invalidate(); },
    onError: (err) => toast.error(apiError(err)),
  });

  const closeIncident = useMutation({
    mutationFn: () =>
      api.post(`/incidents/${id}/close`, { ...rca, generateKbArticle: true }),
    onSuccess: (res) => {
      setShowClose(false);
      invalidate();
      qc.invalidateQueries({ queryKey: ["incidents"] });
      if (res.data.kbArticle) {
        const kbId = res.data.kbArticle.id;
        toast(
          (t) => (
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-200">Artículo KB generado</span>
              <button
                className="px-2.5 py-1 text-xs rounded bg-accent text-white font-medium hover:bg-accent/80 transition-colors"
                onClick={() => { toast.dismiss(t.id); navigate(`/kb/${kbId}`); }}
              >
                Ver
              </button>
              <button
                className="text-slate-500 hover:text-slate-300 transition-colors"
                onClick={() => toast.dismiss(t.id)}
              >
                ✕
              </button>
            </div>
          ),
          { duration: 10000 },
        );
      } else {
        toast.success("Incidencia cerrada");
      }
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => api.put(`/incidents/${id}`, { status }),
    onSuccess: () => { toast.success("Estado actualizado"); invalidate(); },
    onError: (err) => toast.error(apiError(err)),
  });

  if (isLoading || !inc) {
    return (
      <div className="p-5">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-ops-700 rounded w-64" />
          <div className="h-48 bg-ops-800 rounded-lg border border-ops-600" />
        </div>
      </div>
    );
  }

  const completedItems = inc.checklist?.filter((i) => i.completed).length ?? 0;
  const totalItems = inc.checklist?.length ?? 0;
  const isClosed = inc.status === "cerrada" || inc.status === "resuelta";

  const severityGradient: Record<string, string> = {
    critica: "from-red-500/10 to-transparent",
    alta:    "from-orange-500/8 to-transparent",
    media:   "from-amber-500/8 to-transparent",
    baja:    "from-blue-500/8 to-transparent",
    info:    "from-slate-500/5 to-transparent",
  };

  return (
    <div className={cn("p-5 space-y-4 animate-fade-in max-w-5xl bg-gradient-to-b", severityGradient[inc.severity] ?? "")}>
      {/* Breadcrumb + back */}
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <Breadcrumb items={[
            { label: "Dashboard", to: "/" },
            { label: "Incidencias", to: "/incidents" },
            { label: inc.title },
          ]} />
        </div>
      </div>
      {/* Title row */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />} onClick={() => navigate("/incidents")}>
          Volver
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityDot severity={inc.severity as Severity} />
            <h1 className="text-lg font-bold text-slate-100">{inc.title}</h1>
            <Badge className={severityColor[inc.severity as Severity]}>{severityLabel[inc.severity as Severity]}</Badge>
            <Badge className={incidentStatusColor[inc.status as IncidentStatus]}>{incidentStatusLabel[inc.status as IncidentStatus]}</Badge>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDate(inc.createdAt)}</span>
            {inc.system && <span className="flex items-center gap-1">Sistema: <strong className="text-slate-400">{inc.system.name}</strong></span>}
            {inc.assignedUser && <span className="flex items-center gap-1"><User className="w-3 h-3" /> {inc.assignedUser.displayName}</span>}
          </div>
        </div>

        {/* Actions */}
        {!isClosed && (
          <div className="flex gap-2 flex-shrink-0">
            {inc.assignedUser?.id !== currentUser?.id && (
              <Button
                variant="ghost"
                size="sm"
                icon={<UserPlus className="w-4 h-4" />}
                loading={assignToMe.isPending}
                onClick={() => assignToMe.mutate()}
              >
                Asignarme
              </Button>
            )}
            {inc.status === "abierta" && (
              <Button variant="secondary" size="sm" onClick={() => updateStatus.mutate("en_progreso")}>
                Tomar
              </Button>
            )}
            <Button variant="danger" size="sm" onClick={() => setShowClose(true)}>
              Cerrar
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Main content */}
        <div className="col-span-12 lg:col-span-8 space-y-4">
          {/* Description */}
          {inc.description && (
            <Card>
              <CardHeader><CardTitle>Descripción</CardTitle></CardHeader>
              <CardBody>
                <p className="text-sm text-slate-300 whitespace-pre-wrap">{inc.description}</p>
                {inc.impact && (
                  <div className="mt-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                    <p className="text-xs text-amber-400 font-medium mb-1">Impacto</p>
                    <p className="text-sm text-slate-300">{inc.impact}</p>
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {/* Checklist */}
          {totalItems > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Checklist</CardTitle>
                <span className="text-xs text-slate-500">{completedItems}/{totalItems} completados</span>
              </CardHeader>
              <CardBody className="p-0">
                {/* Progress bar */}
                <div className="px-4 pt-3 pb-2">
                  <div className="h-1.5 bg-ops-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: totalItems ? `${(completedItems / totalItems) * 100}%` : "0%" }}
                    />
                  </div>
                </div>
                <div className="divide-y divide-ops-700/50 pb-2">
                  {inc.checklist?.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => !isClosed && toggleChecklist.mutate({ itemId: item.id, completed: !item.completed })}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 transition-colors",
                        !isClosed && "cursor-pointer hover:bg-ops-750",
                      )}
                    >
                      {item.completed ? (
                        <CheckSquare className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600 flex-shrink-0" />
                      )}
                      <span className={cn("text-sm flex-1", item.completed ? "line-through text-slate-600" : "text-slate-300")}>
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}

          {/* RCA (if closed) */}
          {(inc.rootCause || inc.resolution) && (
            <Card className="border-emerald-500/20">
              <CardHeader><CardTitle className="text-emerald-400">Causa Raíz y Resolución</CardTitle></CardHeader>
              <CardBody className="space-y-3">
                {inc.rootCause && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1 uppercase tracking-wide">Causa raíz</p>
                    <p className="text-sm text-slate-300 whitespace-pre-wrap">{inc.rootCause}</p>
                  </div>
                )}
                {inc.resolution && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1 uppercase tracking-wide">Resolución</p>
                    <p className="text-sm text-slate-300 whitespace-pre-wrap">{inc.resolution}</p>
                  </div>
                )}
                {inc.kbArticleId && (
                  <Button variant="ghost" size="sm" icon={<BookOpen className="w-3.5 h-3.5" />} onClick={() => navigate(`/kb/${inc.kbArticleId}`)}>
                    Ver artículo KB generado
                  </Button>
                )}
              </CardBody>
            </Card>
          )}

          {/* Timeline / Comments */}
          <Card>
            <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
            <CardBody className="space-y-3 p-3">
              {inc.comments?.map((c) => {
                const sysIcon = (() => {
                  if (!c.isSystemMessage) return null;
                  const t = c.content.toLowerCase();
                  if (t.includes("cerr") || t.includes("resuel")) return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
                  if (t.includes("asign")) return <UserCheck className="w-3.5 h-3.5 text-blue-400" />;
                  if (t.includes("automatiz") || t.includes("ejecut")) return <Activity className="w-3.5 h-3.5 text-purple-400" />;
                  if (t.includes("estado") || t.includes("status")) return <AlertIcon className="w-3.5 h-3.5 text-amber-400" />;
                  if (t.includes("bloqueado") || t.includes("pendiente")) return <Lock className="w-3.5 h-3.5 text-slate-400" />;
                  return null;
                })();
                return (
                <div key={c.id} className={cn("flex gap-3", c.isSystemMessage && "opacity-70")}>
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs",
                    c.isSystemMessage ? "bg-ops-700 text-slate-500" : "bg-accent/20 text-accent",
                  )}>
                    {c.isSystemMessage ? (sysIcon ?? "⚙") : (c.author?.displayName?.charAt(0) ?? "?")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-400">
                        {c.isSystemMessage ? "Sistema" : c.author?.displayName}
                      </span>
                      <span className="text-xs text-slate-700">{timeAgo(c.createdAt)}</span>
                    </div>
                    <p className={cn("text-sm mt-0.5", c.isSystemMessage ? "text-slate-500 italic" : "text-slate-300")}>
                      {c.content}
                    </p>
                  </div>
                </div>
                );
              })}

              {!isClosed && (
                <div className="flex gap-2 pt-2 border-t border-ops-700">
                  <input
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Añadir comentario..."
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && comment && addComment.mutate()}
                    className="flex-1 bg-ops-850 border border-ops-600 rounded px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-accent"
                  />
                  <Button size="sm" disabled={!comment} loading={addComment.isPending} onClick={() => addComment.mutate()}>
                    Enviar
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          {/* Automation runs */}
          {inc.automationRuns && inc.automationRuns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle><span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Automatizaciones</span></CardTitle>
              </CardHeader>
              <CardBody className="p-0">
                <div className="divide-y divide-ops-700/50">
                  {inc.automationRuns.map((run) => (
                    <div key={run.id} className="px-4 py-2.5 flex items-center gap-2">
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full flex-shrink-0",
                        run.status === "completada" ? "bg-emerald-500"
                          : run.status === "fallida" ? "bg-red-500"
                          : run.status === "ejecutando" ? "bg-blue-500 animate-pulse"
                          : "bg-slate-500",
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-300 truncate">{run.action?.name}</p>
                        <p className="text-xs text-slate-600">{timeAgo(run.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}

          {/* Tags */}
          {inc.tags.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Tags</CardTitle></CardHeader>
              <CardBody>
                <div className="flex flex-wrap gap-1.5">
                  {inc.tags.map((t) => (
                    <span key={t} className="px-2 py-0.5 bg-ops-700 border border-ops-600 text-slate-400 text-xs rounded">
                      {t}
                    </span>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      {/* Close incident dialog */}
      <Dialog open={showClose} onClose={() => setShowClose(false)} title="Cerrar Incidencia con RCA" size="lg">
        <form
          onSubmit={(e) => { e.preventDefault(); closeIncident.mutate(); }}
          className="space-y-4"
        >
          <div className="flex items-start gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300">Se generará automáticamente un artículo en la Base de Conocimiento con esta información.</p>
          </div>
          <Textarea
            label="Causa Raíz *"
            value={rca.rootCause}
            onChange={(e) => setRca((r) => ({ ...r, rootCause: e.target.value }))}
            placeholder="¿Qué causó el problema? Sé específico para que sea útil en el futuro."
            rows={3}
            required
          />
          <Textarea
            label="Resolución *"
            value={rca.resolution}
            onChange={(e) => setRca((r) => ({ ...r, resolution: e.target.value }))}
            placeholder="¿Cómo se resolvió? Pasos detallados para reproducir la solución."
            rows={3}
            required
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setShowClose(false)}>Cancelar</Button>
            <Button type="submit" loading={closeIncident.isPending} icon={<Check className="w-4 h-4" />}>
              Cerrar y generar KB
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
