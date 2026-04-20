import { LogOut, RefreshCw, Wifi, WifiOff, Sun, Moon } from "lucide-react";
import { useAuthStore, useThemeStore } from "../../store/useStore";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import toast from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import type { DashboardSummary } from "../../types";
import { cn } from "../../lib/utils";
import { NotificationBell } from "../notifications/NotificationBell";

export function TopBar() {
  const { user, clearAuth } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();

  const { data: summary, isFetching } = useQuery<DashboardSummary>({
    queryKey: ["dashboard-summary"],
    queryFn: () => api.get("/dashboard/summary").then((r) => r.data),
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    clearAuth();
    navigate("/login");
    toast.success("Sesión cerrada");
  };

  const connectorsDegraded =
    (summary?.connectors.total ?? 0) - (summary?.connectors.healthy ?? 0);

  return (
    <header className="h-12 bg-ops-950 border-b border-ops-600 flex items-center justify-between px-4 flex-shrink-0">
      {/* Left: demo badge + connector status */}
      <div className="flex items-center gap-3">
        {summary?.demoMode && (
          <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs rounded font-mono">
            DEMO
          </span>
        )}
        <div className="flex items-center gap-1.5">
          {connectorsDegraded === 0 ? (
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-amber-400" />
          )}
          <span className="text-xs text-slate-500">
            {summary
              ? `${summary.connectors.healthy}/${summary.connectors.total} conectores`
              : "Cargando..."}
          </span>
        </div>
        {isFetching && <RefreshCw className="w-3 h-3 text-slate-600 animate-spin" />}
      </div>

      {/* Right: theme toggle + notifications bell + user */}
      <div className="flex items-center gap-3">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded hover:bg-ops-700 transition-colors"
          title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4 text-slate-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {/* Notification bell */}
        <NotificationBell />

        <div className="h-4 w-px bg-ops-600" />

        <span className="text-xs text-slate-400">{user?.displayName}</span>

        <button
          onClick={handleLogout}
          className="p-1.5 rounded hover:bg-ops-700 transition-colors text-slate-500 hover:text-red-400"
          title="Cerrar sesión"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
