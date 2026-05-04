import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Dialog } from "../components/ui/Dialog";
import { api } from "../lib/api";
import type { SystemStatusItem, SystemStatus } from "../types";
import { Card, CardBody } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { StatusDot } from "../components/ui/StatusDot";
import {
  Server, Monitor, Database, Globe, RefreshCw, Search, Box, LayoutGrid, Table2, Layers, Download,
} from "lucide-react";
import { cn } from "../lib/utils";
import { usePreferencesStore } from "../store/useStore";

const typeOptions = [
  { value: "", label: "Todos los tipos" },
  { value: "vm", label: "VM" },
  { value: "container", label: "Contenedor" },
  { value: "server", label: "Servidor" },
  { value: "storage", label: "Almacenamiento" },
  { value: "service", label: "Servicio" },
];

const statusOptions = [
  { value: "", label: "Todos los estados" },
  { value: "ok", label: "OK" },
  { value: "degradado", label: "Degradado" },
  { value: "critico", label: "Crítico" },
  { value: "desconocido", label: "Desconocido" },
];

const statusBadgeColor: Record<SystemStatus, string> = {
  ok: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  degradado: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  critico: "text-red-400 bg-red-500/10 border-red-500/30",
  desconocido: "text-slate-400 bg-slate-500/10 border-slate-500/30",
};

const statusLabel: Record<SystemStatus, string> = {
  ok: "OK",
  degradado: "Degradado",
  critico: "Crítico",
  desconocido: "Desconocido",
};

type SystemRow = SystemStatusItem & { displayName: string };

type SortKey = "displayName" | "type" | "status" | "cpu" | "memory" | "disk" | "source";
type SortDir = "asc" | "desc";

const statusRank: Record<SystemStatus, number> = {
  critico: 0,
  degradado: 1,
  desconocido: 2,
  ok: 3,
};

function metricSort(a: number | undefined, b: number | undefined, dir: SortDir): number {
  const mul = dir === "asc" ? 1 : -1;
  if (a == null && b == null) return 0;
  if (a == null) return 1 * mul;
  if (b == null) return -1 * mul;
  return (a - b) * mul;
}

function downloadSystemsCsv(rows: SystemRow[]) {
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const headers = ["displayName", "name", "externalId", "type", "status", "cpu", "memory", "disk", "source"];
  const lines = [headers.join(",")];
  for (const r of rows) {
    const src = String(r.metadata?.source ?? "");
    lines.push(
      [
        esc(r.displayName),
        esc(r.name),
        esc(r.externalId),
        esc(r.type),
        esc(r.status),
        esc(r.metrics?.cpu != null ? String(r.metrics.cpu) : ""),
        esc(r.metrics?.memory != null ? String(r.metrics.memory) : ""),
        esc(r.metrics?.disk != null ? String(r.metrics.disk) : ""),
        esc(src),
      ].join(","),
    );
  }
  const blob = new Blob(["\ufeff", lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sistemas-vivos-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function sortSystemRows(rows: SystemRow[], key: SortKey, dir: SortDir): SystemRow[] {
  const mul = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case "displayName":
        cmp = a.displayName.localeCompare(b.displayName, "es");
        break;
      case "type":
        cmp = a.type.localeCompare(b.type);
        break;
      case "status":
        cmp = statusRank[a.status] - statusRank[b.status];
        break;
      case "cpu":
        return metricSort(a.metrics?.cpu, b.metrics?.cpu, dir);
      case "memory":
        return metricSort(a.metrics?.memory, b.metrics?.memory, dir);
      case "disk":
        return metricSort(a.metrics?.disk, b.metrics?.disk, dir);
      case "source": {
        const sa = String(a.metadata?.source ?? "");
        const sb = String(b.metadata?.source ?? "");
        cmp = sa.localeCompare(sb);
        break;
      }
      default:
        cmp = 0;
    }
    return cmp * mul;
  });
}

function TypeIcon({ type }: { type: string }) {
  if (type === "vm") return <Monitor className="w-5 h-5 text-blue-400" />;
  if (type === "container") return <Box className="w-5 h-5 text-cyan-400" />;
  if (type === "storage") return <Database className="w-5 h-5 text-purple-400" />;
  if (type === "service") return <Globe className="w-5 h-5 text-emerald-400" />;
  return <Server className="w-5 h-5 text-orange-400" />;
}

// Explicit map avoids Tailwind purging dynamic class names
const metricBgMap: Record<string, string> = {
  "text-red-400":     "bg-red-400",
  "text-amber-400":   "bg-amber-400",
  "text-emerald-400": "bg-emerald-400",
};

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  const bgColor = metricBgMap[color] ?? "bg-slate-400";
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs">
        <span className="text-slate-500">{label}</span>
        <span className={cn("font-mono", color)}>{value}%</span>
      </div>
      <div className="h-1 bg-ops-700 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", bgColor)}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}

function SystemDetailDialog({ system, onClose }: { system: SystemRow; onClose: () => void }) {
  const cpu = system.metrics?.cpu;
  const memory = system.metrics?.memory;
  const disk = system.metrics?.disk;
  const cpuColor = (cpu ?? 0) > 90 ? "text-red-400" : (cpu ?? 0) > 70 ? "text-amber-400" : "text-emerald-400";
  const memColor = (memory ?? 0) > 90 ? "text-red-400" : (memory ?? 0) > 70 ? "text-amber-400" : "text-emerald-400";
  const diskColor = (disk ?? 0) > 90 ? "text-red-400" : (disk ?? 0) > 70 ? "text-amber-400" : "text-emerald-400";
  const meta = system.metadata ?? {};

  return (
    <Dialog open title={system.displayName} onClose={onClose} size="md">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <TypeIcon type={system.type} />
          <div>
            <p className="text-xs text-slate-500 capitalize">{system.type}</p>
            <Badge className={statusBadgeColor[system.status as SystemStatus]}>
              {statusLabel[system.status as SystemStatus]}
            </Badge>
          </div>
        </div>

        {(cpu !== undefined || memory !== undefined || disk !== undefined) && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Métricas</p>
            {cpu !== undefined && <MetricBar label="CPU" value={cpu} color={cpuColor} />}
            {memory !== undefined && <MetricBar label="Memoria" value={memory} color={memColor} />}
            {disk !== undefined && <MetricBar label="Disco" value={disk} color={diskColor} />}
          </div>
        )}

        {Object.keys(meta).length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Detalles</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {Object.entries(meta).map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-slate-600 capitalize">{k.replace(/([A-Z])/g, " $1").trim()}</p>
                  <p className="text-xs text-slate-300 truncate font-mono">{String(v)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}

function prettyMetaLabel(key: string) {
  const map: Record<string, string> = {
    source: "Fuente",
    host: "Host",
    model: "Modelo",
    firmware: "Firmware",
    endpoint: "Endpoint",
    node: "Nodo",
    vmid: "VMID",
    powerState: "Estado energía",
    channels: "Canales",
    image: "Imagen",
    state: "Estado",
    status: "Status",
  };
  return map[key] ?? key.replace(/([A-Z])/g, " $1").trim();
}

function compactMeta(system: SystemStatusItem) {
  const meta = system.metadata ?? {};
  const keys = ["source", "host", "model", "firmware", "endpoint", "node", "vmid", "powerState", "channels"];
  return keys
    .filter((k) => meta[k] !== undefined && meta[k] !== null && String(meta[k]).trim() !== "")
    .map((k) => ({ key: k, value: String(meta[k]) }));
}

function SystemCard({ system, onSelect }: { system: SystemRow; onSelect: () => void }) {
  const cpu = system.metrics?.cpu;
  const memory = system.metrics?.memory;
  const disk = system.metrics?.disk;

  const cpuColor = (cpu ?? 0) > 90 ? "text-red-400" : (cpu ?? 0) > 70 ? "text-amber-400" : "text-emerald-400";
  const memColor = (memory ?? 0) > 90 ? "text-red-400" : (memory ?? 0) > 70 ? "text-amber-400" : "text-emerald-400";
  const diskColor = (disk ?? 0) > 90 ? "text-red-400" : (disk ?? 0) > 70 ? "text-amber-400" : "text-emerald-400";

  const source = system.metadata?.source as string | undefined;
  const details = compactMeta(system).slice(0, 3);

  return (
    <Card hover onClick={onSelect} className="flex flex-col gap-3 p-4 cursor-pointer">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <TypeIcon type={system.type} />
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-100 truncate">{system.displayName}</p>
            <p className="text-xs text-slate-500 capitalize">{system.type}</p>
          </div>
        </div>
        <Badge className={statusBadgeColor[system.status as SystemStatus]}>
          {statusLabel[system.status as SystemStatus]}
        </Badge>
      </div>

      {/* Status dot */}
      <div className="flex items-center gap-2">
        <StatusDot status={system.status as SystemStatus} />
        {source && (
          <span className="text-xs text-slate-500 truncate">Fuente: {source}</span>
        )}
      </div>

      {/* Metrics */}
      {(cpu !== undefined || memory !== undefined || disk !== undefined) && (
        <div className="space-y-1.5">
          {cpu !== undefined && <MetricBar label="CPU" value={cpu} color={cpuColor} />}
          {memory !== undefined && <MetricBar label="Memoria" value={memory} color={memColor} />}
          {disk !== undefined && <MetricBar label="Disco" value={disk} color={diskColor} />}
        </div>
      )}

      {/* Metadata badges */}
      {details.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {details.map((d) => (
            <span className="text-xs px-2 py-0.5 bg-ops-700 text-slate-400 rounded">
              {prettyMetaLabel(d.key)}: {d.value}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

function SortTh({
  label,
  colKey,
  activeKey,
  dir,
  onSort,
}: {
  label: string;
  colKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const active = activeKey === colKey;
  return (
    <th scope="col" className="px-3 py-2.5 font-medium whitespace-nowrap">
      <button
        type="button"
        onClick={() => onSort(colKey)}
        className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors"
      >
        {label}
        {active && <span className="text-accent text-[10px] tabular-nums">{dir === "asc" ? "▲" : "▼"}</span>}
      </button>
    </th>
  );
}

function pctCell(v: number | undefined) {
  if (v === undefined || Number.isNaN(v)) return <span className="text-slate-600">—</span>;
  return <span className="font-mono tabular-nums">{Math.round(v)}%</span>;
}

function SystemsTable({
  rows,
  groupSections,
  sortKey,
  sortDir,
  onSort,
  onSelectRow,
  onRename,
}: {
  rows: SystemRow[];
  groupSections: { status: SystemStatus; rows: SystemRow[] }[] | null;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  onSelectRow: (row: SystemRow) => void;
  onRename: (row: SystemRow) => void;
}) {
  const renderRow = (sys: SystemRow) => {
    const src = sys.metadata?.source != null ? String(sys.metadata.source) : "";
    return (
      <tr
        key={sys.externalId}
        onClick={() => onSelectRow(sys)}
        className="border-t border-ops-700/60 hover:bg-ops-800/80 cursor-pointer transition-colors"
      >
        <td className="px-3 py-2.5 font-medium text-slate-100 max-w-[200px]">
          <div className="flex items-center gap-2 min-w-0">
            <TypeIcon type={sys.type} />
            <span className="truncate">{sys.displayName}</span>
          </div>
        </td>
        <td className="px-3 py-2.5 text-slate-400 capitalize whitespace-nowrap">{sys.type}</td>
        <td className="px-3 py-2.5 whitespace-nowrap">
          <Badge className={statusBadgeColor[sys.status]}>{statusLabel[sys.status]}</Badge>
        </td>
        <td className="px-3 py-2.5 text-right">{pctCell(sys.metrics?.cpu)}</td>
        <td className="px-3 py-2.5 text-right">{pctCell(sys.metrics?.memory)}</td>
        <td className="px-3 py-2.5 text-right">{pctCell(sys.metrics?.disk)}</td>
        <td className="px-3 py-2.5 text-slate-500 text-xs max-w-[140px] truncate" title={src || undefined}>
          {src || "—"}
        </td>
        <td className="px-3 py-2.5 text-right whitespace-nowrap">
          <Button
            variant="ghost"
            size="xs"
            onClick={(e) => {
              e.stopPropagation();
              onRename(sys);
            }}
          >
            Alias
          </Button>
        </td>
      </tr>
    );
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-ops-600 bg-ops-900/40 max-h-[min(70vh,720px)] overflow-y-auto">
      <table className="w-full text-sm text-left min-w-[720px]">
        <thead className="sticky top-0 z-10 bg-ops-850 border-b border-ops-600 shadow-sm">
          <tr className="text-xs uppercase tracking-wide text-slate-500">
            <SortTh label="Nombre" colKey="displayName" activeKey={sortKey} dir={sortDir} onSort={onSort} />
            <SortTh label="Tipo" colKey="type" activeKey={sortKey} dir={sortDir} onSort={onSort} />
            <SortTh label="Estado" colKey="status" activeKey={sortKey} dir={sortDir} onSort={onSort} />
            <SortTh label="CPU" colKey="cpu" activeKey={sortKey} dir={sortDir} onSort={onSort} />
            <SortTh label="Mem" colKey="memory" activeKey={sortKey} dir={sortDir} onSort={onSort} />
            <SortTh label="Disco" colKey="disk" activeKey={sortKey} dir={sortDir} onSort={onSort} />
            <SortTh label="Fuente" colKey="source" activeKey={sortKey} dir={sortDir} onSort={onSort} />
            <th scope="col" className="px-3 py-2.5 text-right font-medium text-slate-500">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody>
          {groupSections
            ? groupSections.map(({ status, rows: sectionRows }) => (
                <Fragment key={status}>
                  <tr className="bg-ops-800/90">
                    <td colSpan={8} className="px-3 py-2 text-xs font-semibold text-slate-300">
                      {statusLabel[status]} <span className="text-slate-500 font-normal">({sectionRows.length})</span>
                    </td>
                  </tr>
                  {sectionRows.map((sys) => renderRow(sys))}
                </Fragment>
              ))
            : rows.map((sys) => renderRow(sys))}
        </tbody>
      </table>
    </div>
  );
}

export default function Systems() {
  const systemsViewMode = usePreferencesStore((s) => s.systemsViewMode);
  const setSystemsViewMode = usePreferencesStore((s) => s.setSystemsViewMode);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedSystem, setSelectedSystem] = useState<SystemRow | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("displayName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [groupByStatus, setGroupByStatus] = useState(false);
  const [aliases, setAliases] = useState<Record<string, string>>({});
  const [editingAliasId, setEditingAliasId] = useState<string | null>(null);
  const [aliasDraft, setAliasDraft] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("sysops_system_aliases");
      if (raw) setAliases(JSON.parse(raw));
    } catch {
      // ignore storage parsing issues
    }
  }, []);

  const saveAliases = (next: Record<string, string>) => {
    setAliases(next);
    localStorage.setItem("sysops_system_aliases", JSON.stringify(next));
  };

  const { data: systems, isLoading, refetch, isFetching } = useQuery<SystemStatusItem[]>({
    queryKey: ["dashboard-systems"],
    queryFn: () => api.get("/dashboard/systems").then((r) => r.data),
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const systemsWithAlias = useMemo((): SystemRow[] => {
    return (systems ?? []).map((s) => ({
      ...s,
      displayName: aliases[s.externalId]?.trim() || s.name,
    }));
  }, [systems, aliases]);

  const filtered = systemsWithAlias.filter((s) => {
    const haystack = `${s.displayName} ${s.name}`.toLowerCase();
    if (search && !haystack.includes(search.toLowerCase())) return false;
    if (typeFilter && s.type !== typeFilter) return false;
    if (statusFilter && s.status !== statusFilter) return false;
    return true;
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedRows = useMemo(
    () => sortSystemRows(filtered, sortKey, sortDir),
    [filtered, sortKey, sortDir],
  );

  const groupSections = useMemo(() => {
    if (!groupByStatus) return null;
    const order: SystemStatus[] = ["critico", "degradado", "desconocido", "ok"];
    const buckets = new Map<SystemStatus, SystemRow[]>();
    for (const row of sortedRows) {
      const list = buckets.get(row.status) ?? [];
      list.push(row);
      buckets.set(row.status, list);
    }
    return order
      .filter((st) => (buckets.get(st)?.length ?? 0) > 0)
      .map((st) => ({ status: st, rows: buckets.get(st)! }));
  }, [groupByStatus, sortedRows]);

  const editingRowTable = editingAliasId
    ? systemsWithAlias.find((s) => s.externalId === editingAliasId)
    : undefined;

  const statusCounts = (systems ?? []).reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-5 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Sistemas</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {systemsWithAlias.length ?? 0} sistemas monitorizados
            {statusCounts.critico ? ` · ${statusCounts.critico} críticos` : ""}
            {statusCounts.degradado ? ` · ${statusCounts.degradado} degradados` : ""}
            {" · "}
            <Link to="/settings/inventory" className="text-accent hover:underline">
              Inventario CMDB y mantenimiento
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div
            className="flex rounded-lg border border-ops-600 p-0.5 bg-ops-850/90"
            role="group"
            aria-label="Vista de sistemas"
          >
            <button
              type="button"
              onClick={() => setSystemsViewMode("cards")}
              title="Vista tarjetas"
              aria-pressed={systemsViewMode === "cards"}
              className={cn(
                "p-2 rounded-md transition-colors",
                systemsViewMode === "cards"
                  ? "bg-ops-700 text-slate-100 shadow-sm"
                  : "text-slate-500 hover:text-slate-300",
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setSystemsViewMode("table")}
              title="Vista tabla"
              aria-pressed={systemsViewMode === "table"}
              className={cn(
                "p-2 rounded-md transition-colors",
                systemsViewMode === "table"
                  ? "bg-ops-700 text-slate-100 shadow-sm"
                  : "text-slate-500 hover:text-slate-300",
              )}
            >
              <Table2 className="w-4 h-4" />
            </button>
          </div>
          {systemsViewMode === "table" && (
            <Button
              variant={groupByStatus ? "secondary" : "ghost"}
              size="sm"
              icon={<Layers className="w-3.5 h-3.5" />}
              onClick={() => setGroupByStatus((g) => !g)}
            >
              Agrupar por estado
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            icon={<Download className="w-3.5 h-3.5" />}
            onClick={() => downloadSystemsCsv(sortedRows)}
            disabled={sortedRows.length === 0}
            title="Exportar la vista actual (filtros y orden) a CSV"
          >
            CSV
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />}
            onClick={() => refetch()}
          >
            Actualizar
          </Button>
        </div>
      </div>

      {/* Status summary chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["ok", "degradado", "critico", "desconocido"] as SystemStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter((prev) => (prev === s ? "" : s))}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors",
              statusFilter === s
                ? statusBadgeColor[s]
                : "text-slate-500 bg-ops-800 border-ops-600 hover:border-ops-500",
            )}
          >
            <span>{statusLabel[s]}</span>
            <span className="font-mono">{statusCounts[s] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-48">
          <Input
            placeholder="Buscar por nombre o alias..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="w-3.5 h-3.5" />}
          />
        </div>
        <div className="w-44">
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            options={typeOptions}
          />
        </div>
        <div className="w-44">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={statusOptions}
          />
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 bg-ops-800 rounded-lg border border-ops-600 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardBody className="py-12 text-center">
            <Server className="w-8 h-8 mx-auto mb-2 text-slate-700" />
            <p className="text-slate-600 text-sm">No se encontraron sistemas</p>
          </CardBody>
        </Card>
      ) : systemsViewMode === "table" ? (
        <SystemsTable
          rows={sortedRows}
          groupSections={groupSections}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          onSelectRow={(row) => setSelectedSystem(row)}
          onRename={(row) => {
            setEditingAliasId(row.externalId);
            setAliasDraft(aliases[row.externalId] ?? "");
          }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((sys) => (
            <div key={sys.externalId} className="space-y-1.5">
              <SystemCard system={sys} onSelect={() => setSelectedSystem(sys)} />
              <div className="px-1 flex items-center gap-2">
                {editingAliasId === sys.externalId ? (
                  <>
                    <Input
                      value={aliasDraft}
                      onChange={(e) => setAliasDraft(e.target.value)}
                      placeholder="Alias local"
                    />
                    <Button
                      size="xs"
                      onClick={() => {
                        const value = aliasDraft.trim();
                        const next = { ...aliases };
                        if (!value || value === sys.name) delete next[sys.externalId];
                        else next[sys.externalId] = value;
                        saveAliases(next);
                        setEditingAliasId(null);
                      }}
                    >
                      Guardar
                    </Button>
                    <Button variant="ghost" size="xs" onClick={() => setEditingAliasId(null)}>
                      Cancelar
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="text-xs text-slate-500 truncate">
                      {aliases[sys.externalId] ? `Alias: ${aliases[sys.externalId]}` : "Sin alias"}
                    </span>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        setEditingAliasId(sys.externalId);
                        setAliasDraft(aliases[sys.externalId] ?? "");
                      }}
                    >
                      Renombrar
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {filtered.length > 0 && (
        <p className="text-xs text-slate-600 text-center">
          Mostrando {filtered.length} de {systemsWithAlias.length ?? 0} sistemas
        </p>
      )}

      {selectedSystem && (
        <SystemDetailDialog system={selectedSystem} onClose={() => setSelectedSystem(null)} />
      )}

      {systemsViewMode === "table" && editingAliasId && editingRowTable && (
        <Dialog
          open
          title={`Alias local · ${editingRowTable.displayName}`}
          onClose={() => setEditingAliasId(null)}
          size="sm"
        >
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Nombre en origen: <span className="font-mono text-slate-400">{editingRowTable.name}</span>
            </p>
            <Input
              label="Mostrar como"
              value={aliasDraft}
              onChange={(e) => setAliasDraft(e.target.value)}
              placeholder="Alias en esta pantalla"
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setEditingAliasId(null)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const value = aliasDraft.trim();
                  const next = { ...aliases };
                  if (!value || value === editingRowTable.name) delete next[editingAliasId];
                  else next[editingAliasId] = value;
                  saveAliases(next);
                  setEditingAliasId(null);
                }}
              >
                Guardar
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
