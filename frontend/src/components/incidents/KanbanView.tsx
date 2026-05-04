import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Incident } from "../../types";
import { SeverityDot } from "../ui/StatusDot";
import { Badge } from "../ui/Badge";
import { cn, severityColor, severityLabel, timeAgo } from "../../lib/utils";
import type { Severity, IncidentStatus } from "../../types";
import { api, apiError } from "../../lib/api";
import toast from "react-hot-toast";

const TOP_DOT: Record<IncidentStatus, string> = {
  abierta: "bg-red-500",
  en_progreso: "bg-blue-500",
  pendiente: "bg-amber-500",
  resuelta: "bg-emerald-500",
  cerrada: "bg-slate-500",
};

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
    <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0", m.className)}>{m.label}</span>
  );
}

const COLUMNS: { status: IncidentStatus; label: string; color: string; bar: string }[] = [
  { status: "abierta", label: "Abierta", color: "border-t-red-500", bar: "Barra superior roja: nuevas" },
  { status: "en_progreso", label: "En progreso", color: "border-t-blue-500", bar: "Barra superior azul: en curso" },
  { status: "pendiente", label: "Pendiente", color: "border-t-amber-500", bar: "Barra superior ámbar: esperando" },
  { status: "resuelta", label: "Resuelta", color: "border-t-emerald-500", bar: "Barra superior verde: resuelta" },
  { status: "cerrada", label: "Cerrada", color: "border-t-slate-500", bar: "Barra superior gris: cerrada" },
];

interface KanbanViewProps {
  incidents: Incident[];
}

export function KanbanView({ incidents }: KanbanViewProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [dragId, setDragId] = useState<string | null>(null);

  const moveStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: IncidentStatus }) =>
      api.put(`/incidents/${id}`, { status }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["incidents"] });
      const previous = qc.getQueriesData({ queryKey: ["incidents"] });
      qc.setQueriesData({ queryKey: ["incidents"] }, (old) => {
        if (!old || typeof old !== "object" || !("data" in old)) return old;
        const o = old as { data: Incident[]; total: number; limit: number };
        return {
          ...o,
          data: o.data.map((i) => (i.id === id ? { ...i, status } : i)),
        };
      });
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      ctx?.previous.forEach(([key, data]) => {
        qc.setQueryData(key, data);
      });
      toast.error(apiError(err));
    },
    onSuccess: () => {
      toast.success("Estado actualizado");
      qc.invalidateQueries({ queryKey: ["incidents"] });
    },
  });

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-slate-600">
        Arrastra una tarjeta a otra columna para cambiar el estado. Leyenda por color:{" "}
        {COLUMNS.map((c) => (
          <span key={c.status} className="mr-2">
            <span className={cn("inline-block w-2 h-2 rounded-sm align-middle mr-0.5", TOP_DOT[c.status])} />
            {c.label}
          </span>
        ))}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 items-start">
        {COLUMNS.map(({ status, label, color, bar }) => {
          const cards = incidents.filter((i) => i.status === status);
          return (
            <div
              key={status}
              className="space-y-2 min-w-0"
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/incident-id");
                if (!id) return;
                moveStatus.mutate({ id, status });
                setDragId(null);
              }}
            >
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
                <span className="text-xs font-mono text-slate-600 tabular-nums">{cards.length}</span>
              </div>
              <p className="text-[10px] text-slate-700 px-1 leading-tight">{bar}</p>

              <div className="space-y-2 max-h-[min(70vh,520px)] overflow-y-auto pr-0.5 pb-2 rounded-lg border border-dashed border-ops-600/80 bg-ops-900/30">
                {cards.length === 0 ? (
                  <div className="h-16 mx-1 mt-1 rounded-lg border border-dashed border-ops-600 flex items-center justify-center text-xs text-slate-700">
                    Vacío
                  </div>
                ) : (
                  cards.map((inc) => (
                    <div
                      key={inc.id}
                      role="button"
                      tabIndex={0}
                      draggable
                      onDragStart={(e) => {
                        setDragId(inc.id);
                        e.dataTransfer.setData("text/incident-id", inc.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => navigate(`/incidents/${inc.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigate(`/incidents/${inc.id}`);
                        }
                      }}
                      className={cn(
                        "mx-1 mt-1 bg-ops-800 border border-ops-600 border-t-2 rounded-lg p-3 cursor-grab active:cursor-grabbing",
                        "hover:bg-ops-750 hover:border-ops-500 transition-colors space-y-2 focus:outline-none focus:ring-2 focus:ring-accent/40",
                        color,
                        dragId === inc.id && "opacity-60 ring-1 ring-accent/50",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <SeverityDot severity={inc.severity as Severity} className="mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-slate-200 leading-snug line-clamp-2 flex-1">{inc.title}</p>
                      </div>

                      <div className="flex items-center justify-between gap-1 flex-wrap">
                        <div className="flex items-center gap-1 flex-wrap min-w-0">
                          <Badge className={cn("text-xs shrink-0", severityColor[inc.severity as Severity])}>
                            {severityLabel[inc.severity as Severity]}
                          </Badge>
                          {slaBadge(inc.slaRisk)}
                        </div>
                        <span className="text-xs text-slate-600 truncate tabular-nums">{timeAgo(inc.createdAt)}</span>
                      </div>

                      {inc.assignedUser && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-4 h-4 rounded-full bg-ops-600 flex items-center justify-center text-xs text-slate-400 flex-shrink-0">
                            {inc.assignedUser.displayName.charAt(0)}
                          </div>
                          <span className="text-xs text-slate-500 truncate">{inc.assignedUser.displayName}</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
