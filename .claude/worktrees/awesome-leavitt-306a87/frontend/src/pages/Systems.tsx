import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { SystemStatusItem, SystemStatus } from "../types";
import { Card, CardBody } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { StatusDot } from "../components/ui/StatusDot";
import {
  Server, Monitor, Database, Globe, RefreshCw, Search, Box,
} from "lucide-react";
import { cn, systemStatusColor, timeAgo } from "../lib/utils";

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

function TypeIcon({ type }: { type: string }) {
  if (type === "vm") return <Monitor className="w-5 h-5 text-blue-400" />;
  if (type === "container") return <Box className="w-5 h-5 text-cyan-400" />;
  if (type === "storage") return <Database className="w-5 h-5 text-purple-400" />;
  if (type === "service") return <Globe className="w-5 h-5 text-emerald-400" />;
  return <Server className="w-5 h-5 text-orange-400" />;
}

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs">
        <span className="text-slate-500">{label}</span>
        <span className={cn("font-mono", color)}>{value}%</span>
      </div>
      <div className="h-1 bg-ops-700 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color.replace("text-", "bg-"))}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}

function SystemCard({ system }: { system: SystemStatusItem }) {
  const cpu = system.metrics?.cpu;
  const memory = system.metrics?.memory;
  const disk = system.metrics?.disk;

  const cpuColor = (cpu ?? 0) > 90 ? "text-red-400" : (cpu ?? 0) > 70 ? "text-amber-400" : "text-emerald-400";
  const memColor = (memory ?? 0) > 90 ? "text-red-400" : (memory ?? 0) > 70 ? "text-amber-400" : "text-emerald-400";
  const diskColor = (disk ?? 0) > 90 ? "text-red-400" : (disk ?? 0) > 70 ? "text-amber-400" : "text-emerald-400";

  const powerState = system.metadata?.powerState as string | undefined;
  const image = system.metadata?.image as string | undefined;
  const source = system.metadata?.source as string | undefined;

  return (
    <Card className="flex flex-col gap-3 p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <TypeIcon type={system.type} />
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-100 truncate">{system.name}</p>
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

      {/* Metadata */}
      {(powerState || image) && (
        <div className="flex flex-wrap gap-1.5">
          {powerState && (
            <span className="text-xs px-2 py-0.5 bg-ops-700 text-slate-400 rounded">
              {powerState}
            </span>
          )}
          {image && (
            <span className="text-xs px-2 py-0.5 bg-ops-700 text-slate-400 rounded truncate max-w-full">
              {image}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}

export default function Systems() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data: systems, isLoading, refetch, isFetching } = useQuery<SystemStatusItem[]>({
    queryKey: ["dashboard-systems"],
    queryFn: () => api.get("/dashboard/systems").then((r) => r.data),
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const filtered = (systems ?? []).filter((s) => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter && s.type !== typeFilter) return false;
    if (statusFilter && s.status !== statusFilter) return false;
    return true;
  });

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
            {systems?.length ?? 0} sistemas monitorizados
            {statusCounts.critico ? ` · ${statusCounts.critico} críticos` : ""}
            {statusCounts.degradado ? ` · ${statusCounts.degradado} degradados` : ""}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={<RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />}
          onClick={() => refetch()}
        >
          Actualizar
        </Button>
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
            placeholder="Buscar por nombre..."
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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((sys) => (
            <SystemCard key={sys.externalId} system={sys} />
          ))}
        </div>
      )}

      {filtered.length > 0 && (
        <p className="text-xs text-slate-600 text-center">
          Mostrando {filtered.length} de {systems?.length ?? 0} sistemas
        </p>
      )}
    </div>
  );
}
