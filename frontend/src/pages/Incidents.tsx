import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { Incident } from "../types";
import { Card, CardBody } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { SeverityDot } from "../components/ui/StatusDot";
import { NewIncidentModal } from "../components/incidents/NewIncidentModal";
import {
  Plus, Search, User, Clock, ChevronRight,
  AlertTriangle, AlignJustify, LayoutGrid, Kanban,
} from "lucide-react";
import { EmptyState } from "../components/ui/EmptyState";
import { KanbanView } from "../components/incidents/KanbanView";
import {
  severityColor, severityLabel, incidentStatusColor,
  incidentStatusLabel, timeAgo, cn
} from "../lib/utils";
import type { Severity, IncidentStatus } from "../types";

const statusOptions = [
  { value: "all", label: "Todos los estados" },
  { value: "abierta", label: "Abierta" },
  { value: "en_progreso", label: "En progreso" },
  { value: "pendiente", label: "Pendiente" },
  { value: "resuelta", label: "Resuelta" },
  { value: "cerrada", label: "Cerrada" },
];

const severityOptions = [
  { value: "", label: "Todas las severidades" },
  { value: "critica", label: "Crítica" },
  { value: "alta", label: "Alta" },
  { value: "media", label: "Media" },
  { value: "baja", label: "Baja" },
];

export default function Incidents() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [severity, setSeverity] = useState("");
  const [page, setPage] = useState(1);
  const [showNew, setShowNew] = useState(false);
  const [compact, setCompact] = useState(false);
  const [view, setView] = useState<"list" | "kanban">("list");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["incidents", search, status, severity, page],
    queryFn: () =>
      api.get("/incidents", { params: { search: search || undefined, status, severity: severity || undefined, page } })
        .then((r) => r.data as { data: Incident[]; total: number; limit: number }),
    placeholderData: keepPreviousData,
  });

  const incidents = data?.data ?? [];
  const total = data?.total ?? 0;
  const limit = data?.limit ?? 20;

  return (
    <div className="p-5 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Incidencias</h1>
          <p className="text-xs text-slate-500 mt-0.5">{total} incidencias totales</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-ops-600 rounded-lg overflow-hidden">
            <button
              onClick={() => setView("list")}
              title="Vista lista"
              className={cn("p-1.5 transition-colors", view === "list" ? "bg-ops-600 text-slate-200" : "text-slate-500 hover:text-slate-300")}
            >
              <AlignJustify className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView("kanban")}
              title="Vista kanban"
              className={cn("p-1.5 transition-colors", view === "kanban" ? "bg-ops-600 text-slate-200" : "text-slate-500 hover:text-slate-300")}
            >
              <Kanban className="w-4 h-4" />
            </button>
          </div>
          {view === "list" && (
            <button
              onClick={() => setCompact((v) => !v)}
              title={compact ? "Vista normal" : "Vista compacta"}
              className="p-1.5 rounded hover:bg-ops-700 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          )}
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowNew(true)}>
            Nueva incidencia
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-48">
          <Input
            placeholder="Buscar incidencias..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            icon={<Search className="w-3.5 h-3.5" />}
          />
        </div>
        <div className="w-44">
          <Select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            options={statusOptions}
          />
        </div>
        <div className="w-44">
          <Select
            value={severity}
            onChange={(e) => { setSeverity(e.target.value); setPage(1); }}
            options={severityOptions}
          />
        </div>
      </div>

      {/* Kanban view */}
      {view === "kanban" && !isLoading && (
        <KanbanView incidents={incidents} />
      )}

      {/* List view */}
      {view === "kanban" ? null : <Card>
        <CardBody className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-slate-600 text-sm">Cargando...</div>
          ) : incidents.length === 0 ? (
            <EmptyState
              icon={<AlertTriangle className="w-7 h-7" />}
              title="Sin incidencias"
              description="No se encontraron incidencias con los filtros aplicados."
            />
          ) : (
            <>
              {/* Header row */}
              <div className="grid grid-cols-12 px-4 py-2 border-b border-ops-700 text-xs text-slate-600 uppercase tracking-wide font-medium">
                <div className="col-span-5">Incidencia</div>
                <div className="col-span-2">Severidad</div>
                <div className="col-span-2">Estado</div>
                <div className="col-span-2">Asignado</div>
                <div className="col-span-1" />
              </div>
              <div className="divide-y divide-ops-700/50">
                {incidents.map((inc) => (
                  <div
                    key={inc.id}
                    onClick={() => navigate(`/incidents/${inc.id}`)}
                    className={cn("grid grid-cols-12 px-4 hover:bg-ops-750 cursor-pointer transition-colors items-center group", compact ? "py-1.5" : "py-3")}
                  >
                    {/* Title + system + time */}
                    <div className="col-span-5 flex items-start gap-2.5 min-w-0">
                      <SeverityDot severity={inc.severity as Severity} className="mt-1.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-slate-200 truncate group-hover:text-white">{inc.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {inc.system && (
                            <span className="text-xs text-slate-600">{inc.system.name}</span>
                          )}
                          <span className="text-slate-700">·</span>
                          <span className="text-xs text-slate-600 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {timeAgo(inc.createdAt)}
                          </span>
                        </div>
                        {!compact && inc.tags.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {inc.tags.slice(0, 3).map((t) => (
                              <span key={t} className="px-1.5 py-0.5 bg-ops-700 text-slate-500 text-xs rounded">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Severity */}
                    <div className="col-span-2">
                      <Badge className={cn("text-xs", severityColor[inc.severity as Severity])}>
                        {severityLabel[inc.severity as Severity]}
                      </Badge>
                    </div>

                    {/* Status */}
                    <div className="col-span-2">
                      <Badge className={cn("text-xs", incidentStatusColor[inc.status as IncidentStatus])}>
                        {incidentStatusLabel[inc.status as IncidentStatus]}
                      </Badge>
                    </div>

                    {/* Assigned */}
                    <div className="col-span-2">
                      {inc.assignedUser ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-ops-600 flex items-center justify-center text-xs text-slate-300 flex-shrink-0">
                            {inc.assignedUser.displayName.charAt(0)}
                          </div>
                          <span className="text-xs text-slate-400 truncate">{inc.assignedUser.displayName}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-600">Sin asignar</span>
                      )}
                    </div>

                    <div className="col-span-1 flex justify-end">
                      <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-slate-400 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardBody>
      </Card>}

      {/* Pagination — only in list view */}
      {view === "list" && total > limit && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            Mostrando {(page - 1) * limit + 1}–{Math.min(page * limit, total)} de {total}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="xs" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <Button variant="outline" size="xs" disabled={page * limit >= total} onClick={() => setPage((p) => p + 1)}>
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {showNew && <NewIncidentModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); refetch(); }} />}
    </div>
  );
}
