import { useNavigate } from "react-router-dom";
import type { Incident } from "../../types";
import { SeverityDot } from "../ui/StatusDot";
import { Badge } from "../ui/Badge";
import { cn, severityColor, incidentStatusColor, incidentStatusLabel, timeAgo } from "../../lib/utils";
import type { Severity, IncidentStatus } from "../../types";

const COLUMNS: { status: IncidentStatus; label: string; color: string }[] = [
  { status: "abierta",     label: "Abierta",     color: "border-t-red-500"    },
  { status: "en_progreso", label: "En progreso", color: "border-t-blue-500"   },
  { status: "pendiente",   label: "Pendiente",   color: "border-t-amber-500"  },
  { status: "resuelta",    label: "Resuelta",    color: "border-t-emerald-500" },
];

interface KanbanViewProps {
  incidents: Incident[];
}

export function KanbanView({ incidents }: KanbanViewProps) {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 items-start">
      {COLUMNS.map(({ status, label, color }) => {
        const cards = incidents.filter((i) => i.status === status);
        return (
          <div key={status} className="space-y-2">
            {/* Column header */}
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
              <span className="text-xs font-mono text-slate-600">{cards.length}</span>
            </div>

            {/* Cards */}
            <div className="space-y-2 min-h-24">
              {cards.length === 0 ? (
                <div className="h-16 rounded-lg border border-dashed border-ops-600 flex items-center justify-center text-xs text-slate-700">
                  Vacío
                </div>
              ) : (
                cards.map((inc) => (
                  <div
                    key={inc.id}
                    onClick={() => navigate(`/incidents/${inc.id}`)}
                    className={cn(
                      "bg-ops-800 border border-ops-600 border-t-2 rounded-lg p-3 cursor-pointer",
                      "hover:bg-ops-750 hover:border-ops-500 transition-colors space-y-2",
                      color,
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <SeverityDot severity={inc.severity as Severity} className="mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-slate-200 leading-snug line-clamp-2 flex-1">
                        {inc.title}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-1">
                      <Badge className={cn("text-xs", severityColor[inc.severity as Severity])}>
                        {inc.severity}
                      </Badge>
                      <span className="text-xs text-slate-600 truncate">{timeAgo(inc.createdAt)}</span>
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
  );
}
