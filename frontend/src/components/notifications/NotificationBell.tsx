import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Bell, Info, AlertTriangle, CheckCircle, XCircle, ChevronRight,
} from "lucide-react";
import { api, apiError } from "../../lib/api";
import type { Notification } from "../../types";
import { timeAgo, cn } from "../../lib/utils";
import toast from "react-hot-toast";

function NotifIcon({ type }: { type: Notification["type"] }) {
  if (type === "info") return <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />;
  if (type === "warning") return <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />;
  if (type === "error") return <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />;
  return <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: countData } = useQuery<{ unread: number }>({
    queryKey: ["notifications-count"],
    queryFn: () => api.get("/notifications/count").then((r) => r.data),
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const { data: notifications } = useQuery<Notification[]>({
    queryKey: ["notifications-list"],
    queryFn: () => api.get("/notifications", { params: { limit: 10 } }).then((r) => r.data),
    enabled: open,
    staleTime: 10000,
  });

  const markAllRead = useMutation({
    mutationFn: () => api.patch("/notifications/read-all"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications-count"] });
      qc.invalidateQueries({ queryKey: ["notifications-list"] });
      toast.success("Todas las notificaciones marcadas como leídas");
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications-count"] });
      qc.invalidateQueries({ queryKey: ["notifications-list"] });
    },
  });

  // WebSocket listener
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "notification") {
          qc.invalidateQueries({ queryKey: ["notifications-count"] });
          if (open) qc.invalidateQueries({ queryKey: ["notifications-list"] });
        }
      } catch {}
    };
    // Try to attach to existing WS if available on window
    const ws = (window as unknown as Record<string, unknown>).__sysops_ws as WebSocket | undefined;
    if (ws) ws.addEventListener("message", handleMessage);
    return () => {
      if (ws) ws.removeEventListener("message", handleMessage);
    };
  }, [open, qc]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const unread = countData?.unread ?? 0;

  const handleNotifClick = (n: Notification) => {
    markRead.mutate(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-1.5 rounded hover:bg-ops-700 transition-colors"
        title="Notificaciones"
      >
        <Bell className="w-4 h-4 text-slate-400" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-xs text-white flex items-center justify-center font-bold animate-pulse">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-9 w-80 bg-ops-800 border border-ops-600 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-ops-600">
            <span className="text-sm font-semibold text-slate-200">Notificaciones</span>
            {unread > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="text-xs text-accent hover:underline"
              >
                Marcar todas leídas
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-ops-700">
            {!notifications ? (
              <div className="py-8 text-center text-slate-600 text-xs">Cargando...</div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-slate-600 text-xs">Sin notificaciones</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotifClick(n)}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-ops-750 transition-colors",
                    !n.read && "bg-ops-750/50",
                  )}
                >
                  <div className="mt-0.5">
                    <NotifIcon type={n.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs font-medium truncate", n.read ? "text-slate-400" : "text-slate-200")}>
                      {n.title}
                    </p>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{n.body}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0 mt-1.5" />
                  )}
                  {n.link && <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0 mt-0.5" />}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-ops-600">
            <button
              onClick={() => { setOpen(false); navigate("/notifications"); }}
              className="w-full text-center text-xs text-accent hover:underline py-1"
            >
              Ver todas las notificaciones
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
