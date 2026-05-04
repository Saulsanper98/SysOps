import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { AuditEvent } from "../types";
import { Card, CardBody } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Button } from "../components/ui/Button";
import { ClipboardList, ChevronRight, User, Download, Copy, Check, LayoutList, GitBranch } from "lucide-react";
import { api } from "../lib/api";
import { useQuery } from "@tanstack/react-query";
import type { User as UserType } from "../types";
import { formatDate, cn } from "../lib/utils";
import { usePreferencesStore } from "../store/useStore";

const actionColors: Record<string, string> = {
  create: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  update: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  delete: "text-red-400 bg-red-500/10 border-red-500/20",
  execute: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  login: "text-slate-400 bg-slate-500/10 border-slate-500/20",
  logout: "text-slate-400 bg-slate-500/10 border-slate-500/20",
  close: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  resolve: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  assign: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  escalate: "text-orange-400 bg-orange-500/10 border-orange-500/20",
};

const entityRoutes: Record<string, (id: string) => string> = {
  incident: (id) => `/incidents/${id}`,
  kb_article: (id) => `/kb/${id}`,
  automation_run: (_id) => "/automations",
};

export default function Audit() {
  const navigate = useNavigate();
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [userId, setUserId] = useState("");
  const [page, setPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { auditViewMode, setAuditViewMode } = usePreferencesStore();

  const copyId = useCallback(async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  }, []);

  const { data: users } = useQuery<UserType[]>({
    queryKey: ["users"],
    queryFn: () => api.get("/users").then((r) => r.data),
  });

  const handleExport = (format: "csv" | "json") => {
    const params = new URLSearchParams();
    params.set("format", format);
    if (entityType) params.set("entityType", entityType);
    if (action) params.set("action", action);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (userId) params.set("userId", userId);
    const url = `${(api.defaults.baseURL ?? "").replace(/\/$/, "")}/audit/export?${params}`;
    window.open(url, "_blank");
  };

  const { data, isLoading } = useQuery({
    queryKey: ["audit", entityType, action, from, to, page, userId],
    queryFn: () =>
      api.get("/audit", {
        params: {
          entityType: entityType || undefined,
          action: action || undefined,
          from: from || undefined,
          to: to || undefined,
          userId: userId || undefined,
          page,
          limit: 30,
        },
      }).then((r) => r.data as { data: AuditEvent[]; total: number }),
  });

  const events = data?.data ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="p-5 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Auditoría</h1>
          <p className="text-xs text-slate-500 mt-0.5">Registro completo de acciones · {total} eventos</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex border border-ops-600 rounded-lg overflow-hidden mr-1">
            <button
              type="button"
              title="Vista lista"
              onClick={() => setAuditViewMode("list")}
              className={cn("p-2", auditViewMode === "list" ? "bg-ops-600 text-slate-200" : "text-slate-500 hover:bg-ops-700")}
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              type="button"
              title="Vista timeline"
              onClick={() => setAuditViewMode("timeline")}
              className={cn("p-2", auditViewMode === "timeline" ? "bg-ops-600 text-slate-200" : "text-slate-500 hover:bg-ops-700")}
            >
              <GitBranch className="w-4 h-4" />
            </button>
          </div>
          <Button variant="ghost" size="sm" icon={<Download className="w-3.5 h-3.5" />} onClick={() => handleExport("csv")}>
            CSV
          </Button>
          <Button variant="ghost" size="sm" icon={<Download className="w-3.5 h-3.5" />} onClick={() => handleExport("json")}>
            JSON
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-end gap-3 flex-wrap">
        <div className="w-44">
          <Select
            label="Tipo de entidad"
            value={entityType}
            onChange={(e) => { setEntityType(e.target.value); setPage(1); }}
            options={[
              { value: "", label: "Todas" },
              { value: "incident", label: "Incidencias" },
              { value: "automation_run", label: "Automatizaciones" },
              { value: "kb_article", label: "KB" },
              { value: "user", label: "Usuarios" },
            ]}
          />
        </div>
        <div className="w-40">
          <Select
            label="Acción"
            value={action}
            onChange={(e) => { setAction(e.target.value); setPage(1); }}
            options={[
              { value: "", label: "Todas" },
              { value: "create", label: "Crear" },
              { value: "update", label: "Actualizar" },
              { value: "delete", label: "Eliminar" },
              { value: "execute", label: "Ejecutar" },
              { value: "close", label: "Cerrar" },
              { value: "login", label: "Login" },
              { value: "assign", label: "Asignar" },
            ]}
          />
        </div>
        <Input
          label="Desde"
          type="date"
          value={from}
          onChange={(e) => { setFrom(e.target.value); setPage(1); }}
          className="w-36"
        />
        <Input
          label="Hasta"
          type="date"
          value={to}
          onChange={(e) => { setTo(e.target.value); setPage(1); }}
          className="w-36"
        />
        <div className="w-44">
          <Select
            label="Usuario"
            value={userId}
            onChange={(e) => { setUserId(e.target.value); setPage(1); }}
            options={[
              { value: "", label: "Todos los usuarios" },
              ...(users ?? []).map((u) => ({ value: u.id, label: u.displayName })),
            ]}
          />
        </div>
        {(entityType || action || from || to || userId) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setEntityType(""); setAction(""); setFrom(""); setTo(""); setUserId(""); setPage(1); }}
          >
            Limpiar
          </Button>
        )}
      </div>

      {/* Timeline */}
      <Card>
        <CardBody className="p-0">
          {isLoading ? (
            <div className="py-4 space-y-3 animate-pulse px-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-14 bg-ops-800 rounded-lg border border-ops-700" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="py-12 text-center">
              <ClipboardList className="w-8 h-8 mx-auto mb-2 text-slate-700" />
              <p className="text-slate-600 text-sm">No se encontraron eventos</p>
            </div>
          ) : (
            <div className={cn(auditViewMode === "timeline" && "border-l-2 border-ops-600 ml-4 pl-1")}>
              <div className={auditViewMode === "list" ? "divide-y divide-ops-700/50" : "space-y-6 py-4 pr-2"}>
              {events.map((event, idx) => {
                const targetRoute = event.entityId && entityRoutes[event.entityType]?.(event.entityId);
                return (
                  <div
                    key={event.id}
                    className={cn(
                      "flex items-start gap-4 px-4 py-3 transition-colors",
                      auditViewMode === "list" && "border-ops-700/50",
                      auditViewMode === "timeline" && "relative pl-6 -ml-1",
                      targetRoute && "hover:bg-ops-750 cursor-pointer group",
                    )}
                    onClick={() => targetRoute && navigate(targetRoute)}
                  >
                    <div className="flex flex-col items-center pt-1">
                      <div
                        className={cn(
                          "rounded-full flex-shrink-0",
                          auditViewMode === "timeline" ? "w-3 h-3 -ml-[2px] ring-4 ring-ops-900" : "w-2 h-2",
                          actionColors[event.action]?.split(" ")[0]?.replace("text-", "bg-") ?? "bg-slate-500",
                        )}
                      />
                      {auditViewMode === "list" && idx < events.length - 1 && (
                        <div className="w-px flex-1 bg-ops-700 mt-1 min-h-4" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 pb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          "inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border",
                          actionColors[event.action] ?? "text-slate-400 bg-slate-500/10 border-slate-500/20",
                        )}>
                          {event.action}
                        </span>
                        <span className="text-xs text-slate-500 font-mono">{event.entityType}</span>
                        {event.entityName && (
                          <span className="text-xs text-slate-400 truncate max-w-48">{event.entityName}</span>
                        )}
                      </div>

                      <p className="text-sm text-slate-300 mt-0.5">{event.description}</p>

                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-600">
                        {event.user && (
                          <span className="flex items-center gap-1">
                            <User className="w-2.5 h-2.5" />
                            {event.user.displayName}
                          </span>
                        )}
                        <span title={formatDate(event.createdAt)}>{formatDate(event.createdAt)}</span>
                        {event.ipAddress && <span className="font-mono">{event.ipAddress}</span>}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          className="text-xs text-slate-500 hover:text-accent inline-flex items-center gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            void copyId(event.id);
                          }}
                        >
                          {copiedId === event.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          Copiar ID
                        </button>
                      </div>
                    </div>

                    {targetRoute && (
                      <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-slate-400 transition-colors flex-shrink-0 mt-1" />
                    )}
                  </div>
                );
              })}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Pagination */}
      {total > 30 && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Página {page} · {total} eventos totales</span>
          <div className="flex gap-2">
            <Button variant="outline" size="xs" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
            <Button variant="outline" size="xs" disabled={page * 30 >= total} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
          </div>
        </div>
      )}
    </div>
  );
}
