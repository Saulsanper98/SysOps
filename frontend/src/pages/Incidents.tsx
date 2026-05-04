import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation, keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, apiError } from "../lib/api";
import type { Incident, User } from "../types";
import { useAuthStore, usePreferencesStore } from "../store/useStore";
import { Card, CardBody } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Dialog } from "../components/ui/Dialog";
import { downloadIncidentsCsv } from "../lib/incidentsExport";
import type { IncidentSavedView } from "../store/useStore";
import { SeverityDot } from "../components/ui/StatusDot";
import { NewIncidentModal } from "../components/incidents/NewIncidentModal";
import {
  Plus, Search, User as UserIcon, Clock, ChevronRight,
  AlertTriangle, AlignJustify, LayoutGrid, Kanban,
  ArrowUp, ArrowDown, ArrowUpDown, MoreHorizontal, ExternalLink, X,
  Download, BookmarkPlus, Trash2,
} from "lucide-react";
import { EmptyState } from "../components/ui/EmptyState";
import { KanbanView } from "../components/incidents/KanbanView";
import {
  severityColor, severityLabel, incidentStatusColor,
  incidentStatusLabel, timeAgo, formatDate, cn
} from "../lib/utils";
import type { Severity, IncidentStatus } from "../types";
import toast from "react-hot-toast";

const slaRiskOptions = [
  { value: "any", label: "SLA: todos" },
  { value: "breach", label: "SLA incumplido" },
  { value: "warning", label: "SLA próximo (<1h)" },
];

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

type SortKey = "title" | "severity" | "status" | "createdAt";
type SortDir = "asc" | "desc";

const SEVERITY_ORDER: Record<string, number> = { critica: 1, alta: 2, media: 3, baja: 4, info: 5 };
const STATUS_ORDER: Record<string, number> = { abierta: 1, en_progreso: 2, pendiente: 3, resuelta: 4, cerrada: 5 };

function IncidentsListSkeleton({ compact }: { compact: boolean }) {
  return (
    <div className="divide-y divide-ops-700/50 animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className={cn("grid grid-cols-12 px-4 gap-2 items-center", compact ? "py-2" : "py-3")}>
          <div className="col-span-4 h-4 bg-ops-700 rounded" />
          <div className="col-span-2 h-4 bg-ops-700 rounded w-16" />
          <div className="col-span-2 h-4 bg-ops-700 rounded w-20" />
          <div className="col-span-2 h-4 bg-ops-700 rounded w-24" />
          <div className="col-span-2 h-4 bg-ops-700 rounded w-20" />
        </div>
      ))}
    </div>
  );
}

function slaBadge(risk: Incident["slaRisk"]) {
  if (!risk || risk === "ok") return null;
  const map: Record<string, { label: string; className: string }> = {
    warning: { label: "SLA ⚠", className: "text-amber-400 border-amber-500/40 bg-amber-500/10" },
    response_breach: { label: "SLA resp.", className: "text-red-400 border-red-500/40 bg-red-500/10" },
    resolution_breach: { label: "SLA resol.", className: "text-red-400 border-red-500/40 bg-red-500/10" },
  };
  const m = map[risk];
  if (!m) return null;
  return (
    <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", m.className)}>{m.label}</span>
  );
}

export default function Incidents() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user: currentUser } = useAuthStore();
  const { uiDensity, setUiDensity } = usePreferencesStore();
  const incidentsSavedViews = usePreferencesStore((s) => s.incidentsSavedViews);
  const pushIncidentsSavedView = usePreferencesStore((s) => s.pushIncidentsSavedView);
  const removeIncidentsSavedView = usePreferencesStore((s) => s.removeIncidentsSavedView);

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "all");
  const [severity, setSeverity] = useState(searchParams.get("severity") ?? "");
  const [assignedToMe, setAssignedToMe] = useState(searchParams.get("mine") === "1");
  const [page, setPage] = useState(Number(searchParams.get("page") ?? "1") || 1);
  const perFromUrl = Number(searchParams.get("per") ?? "20");
  const initialPer = [10, 20, 50].includes(perFromUrl) ? perFromUrl : 20;
  const [perPage, setPerPage] = useState(initialPer);
  const [showNew, setShowNew] = useState(false);
  const [compact, setCompact] = useState(uiDensity === "compact");
  const [view, setView] = useState<"list" | "kanban">((searchParams.get("view") as "list" | "kanban") || "list");
  const [sortBy, setSortBy] = useState<SortKey | null>((searchParams.get("sort") as SortKey) || null);
  const [sortDir, setSortDir] = useState<SortDir>((searchParams.get("dir") as SortDir) || "desc");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState("");
  const [dateFrom, setDateFrom] = useState(searchParams.get("from") ?? "");
  const [dateTo, setDateTo] = useState(searchParams.get("to") ?? "");
  const [slaRisk, setSlaRisk] = useState(searchParams.get("slaRisk") ?? "any");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [bulkStatus, setBulkStatus] = useState<IncidentStatus>("en_progreso");

  const applySavedView = (v: IncidentSavedView) => {
    setSearch(v.search);
    setStatus(v.status);
    setSeverity(v.severity);
    setAssignedToMe(v.assignedToMe);
    setPage(1);
  };

  const rowPreview = (inc: Incident) => {
    const parts = [inc.description?.trim(), inc.system?.name ? `Sistema: ${inc.system.name}` : ""].filter(Boolean);
    const t = parts.join("\n\n");
    return (t || inc.title).slice(0, 420);
  };

  const syncUrl = useCallback(() => {
    const p = new URLSearchParams();
    if (search) p.set("q", search);
    if (status !== "all") p.set("status", status);
    if (severity) p.set("severity", severity);
    if (assignedToMe) p.set("mine", "1");
    if (page > 1) p.set("page", String(page));
    if (perPage !== 20) p.set("per", String(perPage));
    if (view !== "list") p.set("view", view);
    if (sortBy) p.set("sort", sortBy);
    if (sortDir !== "desc") p.set("dir", sortDir);
    if (dateFrom) p.set("from", dateFrom);
    if (dateTo) p.set("to", dateTo);
    if (slaRisk && slaRisk !== "any") p.set("slaRisk", slaRisk);
    setSearchParams(p, { replace: true });
  }, [search, status, severity, assignedToMe, page, perPage, view, sortBy, sortDir, dateFrom, dateTo, slaRisk, setSearchParams]);

  useEffect(() => {
    const t = setTimeout(syncUrl, 0);
    return () => clearTimeout(t);
  }, [syncUrl]);

  useEffect(() => {
    setUiDensity(compact ? "compact" : "comfortable");
  }, [compact, setUiDensity]);

  useEffect(() => {
    if (!menuOpenId) return;
    const close = () => setMenuOpenId(null);
    const id = window.setTimeout(() => document.addEventListener("click", close), 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("click", close);
    };
  }, [menuOpenId]);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key);
      setSortDir(key === "createdAt" ? "desc" : "asc");
    }
  };

  const assignedToFilter = assignedToMe ? currentUser?.id : undefined;
  const listLimit = view === "kanban" ? 100 : perPage;

  const { data: assignUsers } = useQuery<User[]>({
    queryKey: ["users-assignable"],
    queryFn: () => api.get("/users/assignable").then((r) => r.data),
    staleTime: 120_000,
    enabled: currentUser?.role !== "readonly",
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["incidents", search, status, severity, page, assignedToFilter, listLimit, view, perPage, dateFrom, dateTo, slaRisk],
    queryFn: () =>
      api.get("/incidents", {
        params: {
          search: search || undefined,
          status,
          severity: severity || undefined,
          page: view === "kanban" ? 1 : page,
          limit: listLimit,
          assignedTo: assignedToFilter,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          slaRisk: slaRisk && slaRisk !== "any" ? slaRisk : undefined,
        },
      }).then((r) => r.data as { data: Incident[]; total: number; limit: number }),
    placeholderData: keepPreviousData,
  });

  const bulkMutation = useMutation({
    mutationFn: (body: { ids: string[]; status?: IncidentStatus }) => api.patch("/incidents/bulk", body),
    onSuccess: (_, v) => {
      toast.success(`Actualizadas ${v.ids.length} incidencias`);
      setSelected({});
      qc.invalidateQueries({ queryKey: ["incidents"] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) => api.patch(`/incidents/${id}/assign`, { userId }),
    onSuccess: () => {
      toast.success("Asignación actualizada");
      qc.invalidateQueries({ queryKey: ["incidents"] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const selectedIds = useMemo(() => Object.entries(selected).filter(([, v]) => v).map(([k]) => k), [selected]);
  const selectedCount = selectedIds.length;

  const rawIncidents = data?.data ?? [];
  const total = data?.total ?? 0;
  const limit = data?.limit ?? listLimit;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / Math.max(limit, 1))), [total, limit]);
  const paginationPages = useMemo(() => {
    const t = totalPages;
    const c = page;
    if (t <= 9) return Array.from({ length: t }, (_, i) => i + 1);
    const set = new Set<number>([1, t, c, c - 1, c + 1, c - 2, c + 2]);
    return [...set].filter((p) => p >= 1 && p <= t).sort((a, b) => a - b);
  }, [totalPages, page]);

  const incidents = useMemo(() => {
    if (!sortBy) return rawIncidents;
    return [...rawIncidents].sort((a, b) => {
      let cmp = 0;
      if (sortBy === "title") cmp = a.title.localeCompare(b.title);
      else if (sortBy === "severity") cmp = (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9);
      else if (sortBy === "status") cmp = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
      else if (sortBy === "createdAt") cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rawIncidents, sortBy, sortDir]);

  const activeChips: { key: string; label: string; onRemove: () => void }[] = [];
  if (search) activeChips.push({ key: "q", label: `Buscar: ${search}`, onRemove: () => { setSearch(""); setPage(1); } });
  if (status !== "all") activeChips.push({ key: "st", label: `Estado: ${status}`, onRemove: () => { setStatus("all"); setPage(1); } });
  if (severity) activeChips.push({ key: "sev", label: `Severidad: ${severity}`, onRemove: () => { setSeverity(""); setPage(1); } });
  if (assignedToMe) activeChips.push({ key: "mine", label: "Mis incidencias", onRemove: () => { setAssignedToMe(false); setPage(1); } });
  if (dateFrom) activeChips.push({ key: "from", label: `Desde ${dateFrom}`, onRemove: () => { setDateFrom(""); setPage(1); } });
  if (dateTo) activeChips.push({ key: "to", label: `Hasta ${dateTo}`, onRemove: () => { setDateTo(""); setPage(1); } });
  if (slaRisk && slaRisk !== "any") activeChips.push({ key: "sla", label: slaRiskOptions.find((o) => o.value === slaRisk)?.label ?? slaRisk, onRemove: () => { setSlaRisk("any"); setPage(1); } });

  return (
    <div className="p-5 space-y-4 animate-fade-in">
      <div className="sticky top-0 z-dropdown -mx-5 px-5 py-2 bg-ops-900/95 backdrop-blur border-b border-ops-700/50 mb-2">
        <div className="flex items-center justify-between max-w-content mx-auto">
          <div>
            <h1 className="text-lg font-bold text-slate-100 tracking-tight">Incidencias</h1>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">{total} incidencias totales</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-ops-600 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => { setView("list"); setPage(1); }}
                title="Vista lista"
                className={cn("p-2 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors", view === "list" ? "bg-ops-600 text-slate-200" : "text-slate-500 hover:text-slate-300")}
              >
                <AlignJustify className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => { setView("kanban"); setPage(1); }}
                title="Vista kanban"
                className={cn("p-2 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors", view === "kanban" ? "bg-ops-600 text-slate-200" : "text-slate-500 hover:text-slate-300")}
              >
                <Kanban className="w-4 h-4" />
              </button>
            </div>
            {view === "list" && (
              <button
                type="button"
                onClick={() => setCompact((v) => !v)}
                title={compact ? "Vista normal" : "Vista compacta"}
                className="p-2 rounded hover:bg-ops-700 text-slate-500 hover:text-slate-300 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            )}
            {view === "list" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Download className="w-4 h-4" />}
                  disabled={incidents.length === 0}
                  title={`Exporta las filas de esta página (máx. ${listLimit})`}
                  onClick={() =>
                    downloadIncidentsCsv(
                      incidents,
                      `incidencias-pag${page}-${new Date().toISOString().slice(0, 10)}.csv`,
                    )
                  }
                >
                  CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<BookmarkPlus className="w-4 h-4" />}
                  onClick={() => {
                    setSaveViewName("");
                    setSaveViewOpen(true);
                  }}
                >
                  Guardar vista
                </Button>
              </>
            )}
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowNew(true)}>
              Nueva incidencia
            </Button>
          </div>
        </div>
      </div>

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
        <button
          type="button"
          onClick={() => { setAssignedToMe((v) => !v); setPage(1); }}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors min-h-[40px]",
            assignedToMe
              ? "bg-accent/20 border-accent/40 text-accent"
              : "bg-ops-800 border-ops-600 text-slate-500 hover:border-ops-500 hover:text-slate-300",
          )}
        >
          <UserIcon className="w-3.5 h-3.5" />
          Mis incidencias
        </button>
        <div className="w-40">
          <Select
            value={slaRisk}
            onChange={(e) => { setSlaRisk(e.target.value); setPage(1); }}
            options={slaRiskOptions}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Desde</label>
          <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
        </div>
        <div className="w-40">
          <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Hasta</label>
          <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
        </div>
      </div>

      {view === "list" && selectedCount > 0 && currentUser?.role !== "readonly" && (
        <Card>
          <CardBody className="py-3 px-4 flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-300">{selectedCount} seleccionadas</span>
            <div className="w-44">
              <Select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value as IncidentStatus)}
                options={statusOptions.filter((o) => o.value !== "all")}
              />
            </div>
            <Button
              size="sm"
              loading={bulkMutation.isPending}
              onClick={() => bulkMutation.mutate({ ids: selectedIds, status: bulkStatus })}
            >
              Aplicar estado
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected({})}>
              Quitar selección
            </Button>
          </CardBody>
        </Card>
      )}

      {incidentsSavedViews.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-600">Vistas:</span>
          {incidentsSavedViews.map((v) => (
            <span
              key={v.id}
              className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full border border-ops-600 bg-ops-800 text-slate-300"
            >
              <button type="button" className="hover:text-white transition-colors" onClick={() => applySavedView(v)}>
                {v.name}
              </button>
              <button
                type="button"
                className="p-0.5 rounded hover:bg-ops-700 text-slate-500"
                aria-label={`Eliminar vista ${v.name}`}
                onClick={() => removeIncidentsSavedView(v.id)}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-600">Filtros:</span>
          {activeChips.map((c) => (
            <span
              key={c.key}
              className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full border border-ops-600 bg-ops-800 text-xs text-slate-300"
            >
              {c.label}
              <button type="button" className="p-0.5 rounded hover:bg-ops-700 text-slate-500" onClick={c.onRemove} aria-label={`Quitar ${c.label}`}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <Button variant="ghost" size="xs" onClick={() => { setSearch(""); setStatus("all"); setSeverity(""); setAssignedToMe(false); setDateFrom(""); setDateTo(""); setSlaRisk("any"); setPage(1); }}>
            Limpiar todo
          </Button>
        </div>
      )}

      {view === "kanban" && !isLoading && <KanbanView incidents={incidents} />}

      {view === "kanban" ? null : (
        <Card>
          <CardBody className="p-0 overflow-x-auto">
            {isLoading ? (
              <IncidentsListSkeleton compact={compact} />
            ) : incidents.length === 0 ? (
              <EmptyState
                icon={<AlertTriangle className="w-7 h-7" />}
                title="Sin incidencias"
                description="No se encontraron incidencias con los filtros aplicados."
              />
            ) : (
              <>
                <div className="grid grid-cols-12 min-w-[760px] px-4 py-2 border-b border-ops-700 text-xs text-slate-600 font-medium">
                  <div className="col-span-1 flex items-center">
                    <input
                      type="checkbox"
                      title="Seleccionar página"
                      className="rounded border-ops-600"
                      checked={incidents.length > 0 && incidents.every((i) => selected[i.id])}
                      onChange={(e) => {
                        e.stopPropagation();
                        const next: Record<string, boolean> = { ...selected };
                        if (e.target.checked) incidents.forEach((i) => { next[i.id] = true; });
                        else incidents.forEach((i) => { delete next[i.id]; });
                        setSelected(next);
                      }}
                    />
                  </div>
                  {(["title", "severity", "status"] as SortKey[]).map((key, i) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleSort(key)}
                      className={cn(
                        "flex items-center gap-1 hover:text-slate-400 transition-colors text-left",
                        i === 0 ? "col-span-3" : "col-span-2",
                        sortBy === key && "text-slate-400",
                      )}
                    >
                      {key === "title" ? "Incidencia" : key === "severity" ? "Severidad" : "Estado"}
                      {sortBy === key
                        ? sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleSort("createdAt")}
                    className={cn("col-span-2 flex items-center gap-1 hover:text-slate-400 transition-colors text-left", sortBy === "createdAt" && "text-slate-400")}
                  >
                    Creado
                    {sortBy === "createdAt"
                      ? sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                  </button>
                  <div className="col-span-2 text-left pl-1">Asignado</div>
                </div>
                <div className="divide-y divide-ops-700/50 min-w-[760px]">
                  {incidents.map((inc) => (
                    <div
                      key={inc.id}
                      role="link"
                      tabIndex={0}
                      title={rowPreview(inc)}
                      onClick={() => navigate(`/incidents/${inc.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigate(`/incidents/${inc.id}`);
                        }
                      }}
                      className={cn("grid grid-cols-12 px-4 hover:bg-ops-750 cursor-pointer transition-colors items-center group", compact ? "py-1.5" : "py-3")}
                    >
                      <div className="col-span-1 flex items-center pt-1" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="rounded border-ops-600"
                          checked={!!selected[inc.id]}
                          onChange={(e) => {
                            e.stopPropagation();
                            setSelected((s) => ({ ...s, [inc.id]: e.target.checked }));
                          }}
                        />
                      </div>
                      <div className="col-span-3 flex items-start gap-2.5 min-w-0">
                        <SeverityDot severity={inc.severity as Severity} className="mt-1.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-slate-200 truncate group-hover:text-white">{inc.title}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {slaBadge(inc.slaRisk)}
                            {inc.system && <span className="text-xs text-slate-600">{inc.system.name}</span>}
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
                      <div className="col-span-2">
                        <Badge className={cn("text-xs", severityColor[inc.severity as Severity])}>
                          {severityLabel[inc.severity as Severity]}
                        </Badge>
                      </div>
                      <div className="col-span-2">
                        <Badge className={cn("text-xs", incidentStatusColor[inc.status as IncidentStatus])}>
                          {incidentStatusLabel[inc.status as IncidentStatus]}
                        </Badge>
                      </div>
                      <div className="col-span-2 text-xs text-slate-500 tabular-nums" title={formatDate(inc.createdAt)}>
                        <span className="flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5 flex-shrink-0" />
                          {timeAgo(inc.createdAt)}
                        </span>
                      </div>
                      <div className="col-span-2 flex items-center justify-between gap-1 min-w-0">
                        <div className="min-w-0">
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
                        <div className="relative flex-shrink-0" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="p-1.5 rounded hover:bg-ops-700 text-slate-600"
                            aria-label="Más acciones"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpenId((id) => (id === inc.id ? null : inc.id));
                            }}
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          {menuOpenId === inc.id && (
                            <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-ops-600 bg-ops-800 shadow-elev-2 z-dropdown py-1 text-left">
                              <button
                                type="button"
                                className="w-full px-3 py-2 text-xs text-left text-slate-300 hover:bg-ops-750 flex items-center gap-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMenuOpenId(null);
                                  navigate(`/incidents/${inc.id}`);
                                }}
                              >
                                Abrir
                              </button>
                              <button
                                type="button"
                                className="w-full px-3 py-2 text-xs text-left text-slate-300 hover:bg-ops-750 flex items-center gap-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMenuOpenId(null);
                                  window.open(`/incidents/${inc.id}`, "_blank", "noopener,noreferrer");
                                }}
                              >
                                <ExternalLink className="w-3.5 h-3.5" /> Nueva pestaña
                              </button>
                              {currentUser?.role !== "readonly" && assignUsers?.map((u) => (
                                <button
                                  key={u.id}
                                  type="button"
                                  className="w-full px-3 py-2 text-xs text-left text-slate-300 hover:bg-ops-750"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuOpenId(null);
                                    assignMutation.mutate({ id: inc.id, userId: u.id });
                                  }}
                                >
                                  Asignar → {u.displayName}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-slate-400 transition-colors hidden sm:block" />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardBody>
        </Card>
      )}

      {view === "list" && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-500 tabular-nums">
          <div className="flex flex-wrap items-center gap-3">
            <span>
              Mostrando {(page - 1) * limit + 1}–{Math.min(page * limit, total)} de {total}
            </span>
            <label className="flex items-center gap-2 text-slate-600">
              Por página
              <select
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-ops-800 border border-ops-600 rounded-md px-2 py-1.5 text-slate-300 text-xs min-h-[36px]"
              >
                {[10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center gap-1 justify-end">
              <Button variant="outline" size="xs" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              {paginationPages.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={cn(
                    "min-w-[2rem] min-h-[32px] px-2 rounded-md border text-xs font-medium transition-colors",
                    p === page
                      ? "border-accent/50 bg-accent/10 text-accent"
                      : "border-ops-600 bg-ops-800 text-slate-400 hover:border-ops-500 hover:text-slate-200",
                  )}
                >
                  {p}
                </button>
              ))}
              <Button variant="outline" size="xs" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Siguiente
              </Button>
            </div>
          )}
        </div>
      )}

      {showNew && <NewIncidentModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); refetch(); }} />}

      <Dialog
        open={saveViewOpen}
        onClose={() => setSaveViewOpen(false)}
        title="Guardar vista de filtros"
        description="Se guardan búsqueda, estado, severidad y «mis incidencias» en este navegador."
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="Nombre de la vista"
            value={saveViewName}
            onChange={(e) => setSaveViewName(e.target.value)}
            placeholder="Ej. Mis críticas abiertas"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSaveViewOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={!saveViewName.trim()}
              onClick={() => {
                pushIncidentsSavedView({
                  name: saveViewName.trim(),
                  search,
                  status,
                  severity,
                  assignedToMe,
                });
                setSaveViewOpen(false);
                setSaveViewName("");
              }}
            >
              Guardar
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
