import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Bell, Info, AlertTriangle, CheckCircle, XCircle, CheckCheck } from "lucide-react";
import { api, apiError } from "../lib/api";
import type { Notification } from "../types";
import { timeAgo, cn } from "../lib/utils";
import { Card, CardHeader, CardTitle, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import toast from "react-hot-toast";

function NotifIcon({ type }: { type: Notification["type"] }) {
  if (type === "info")    return <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />;
  if (type === "warning") return <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />;
  if (type === "error")   return <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />;
  return <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />;
}

export default function Notifications() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: notifications, isLoading } = useQuery<Notification[]>({
    queryKey: ["notifications-all"],
    queryFn: () => api.get("/notifications", { params: { limit: 100 } }).then((r) => r.data),
    staleTime: 10000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications-all"] });
      qc.invalidateQueries({ queryKey: ["notifications-count"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => api.patch("/notifications/read-all"),
    onSuccess: () => {
      toast.success("Todas las notificaciones marcadas como leídas");
      qc.invalidateQueries({ queryKey: ["notifications-all"] });
      qc.invalidateQueries({ queryKey: ["notifications-count"] });
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const deleteNotif = useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications-all"] });
      qc.invalidateQueries({ queryKey: ["notifications-count"] });
    },
  });

  const handleClick = (n: Notification) => {
    if (!n.read) markRead.mutate(n.id);
    if (n.link) navigate(n.link);
  };

  const unreadCount = notifications?.filter((n) => !n.read).length ?? 0;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100">Notificaciones</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {unreadCount > 0 ? `${unreadCount} sin leer` : "Todo al día"}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <Button
            size="sm"
            variant="ghost"
            icon={<CheckCheck className="w-3.5 h-3.5" />}
            loading={markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            Marcar todas leídas
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Todas las notificaciones</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {isLoading ? (
            <div className="py-16 text-center text-slate-600 text-sm">Cargando...</div>
          ) : !notifications?.length ? (
            <div className="py-16 flex flex-col items-center gap-3 text-center">
              <Bell className="w-10 h-10 text-slate-700" />
              <p className="text-slate-600 text-sm">Sin notificaciones</p>
            </div>
          ) : (
            <div className="divide-y divide-ops-700/50">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 group hover:bg-ops-750 transition-colors",
                    !n.read && "bg-ops-750/40",
                  )}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    <NotifIcon type={n.type} />
                  </div>
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => handleClick(n)}
                  >
                    <p className={cn("text-sm font-medium", n.read ? "text-slate-400" : "text-slate-200")}>
                      {n.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-xs text-slate-600 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!n.read && (
                      <button
                        onClick={() => markRead.mutate(n.id)}
                        className="p-1 rounded hover:bg-ops-600 text-slate-600 hover:text-emerald-400 transition-colors"
                        title="Marcar como leída"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotif.mutate(n.id)}
                      className="p-1 rounded hover:bg-ops-600 text-slate-600 hover:text-red-400 transition-colors"
                      title="Eliminar"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0 mt-1.5" />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
