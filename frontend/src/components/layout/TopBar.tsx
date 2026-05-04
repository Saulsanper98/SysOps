import { RefreshCw, Sun, Moon, Search, Menu } from "lucide-react";
import { useThemeStore, usePreferencesStore } from "../../store/useStore";
import { useLocation } from "react-router-dom";
import { api } from "../../lib/api";
import { useQuery } from "@tanstack/react-query";
import type { DashboardSummary } from "../../types";
import { formatDate } from "../../lib/utils";
import { NotificationBell } from "../notifications/NotificationBell";
import { TopBarConnectorsMenu } from "./TopBarConnectorsMenu";
import { UserMenu } from "./UserMenu";
import { pageTitleForPath } from "../../lib/routesMeta";

export function TopBar({
  onOpenCommandPalette,
  onOpenMobileNav,
}: {
  onOpenCommandPalette?: () => void;
  onOpenMobileNav?: () => void;
}) {
  const { theme, toggleTheme } = useThemeStore();
  const { pathname } = useLocation();
  const { themeHintDismissed, dismissThemeHint } = usePreferencesStore();

  const { data: summary, isFetching, dataUpdatedAt } = useQuery<DashboardSummary>({
    queryKey: ["dashboard-summary"],
    queryFn: () => api.get("/dashboard/summary").then((r) => r.data),
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const title = pageTitleForPath(pathname);
  const lastSync =
    dataUpdatedAt > 0 ? formatDate(new Date(dataUpdatedAt), "HH:mm:ss") : "—";

  return (
    <div className="min-h-12 bg-ops-950 border-b border-[color:var(--border-default)] flex flex-col flex-shrink-0">
      {!themeHintDismissed && (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-accent/5 border-b border-accent/20 text-[11px] text-slate-400">
          <span>
            Consejo: el icono <strong className="text-slate-300">sol / luna</strong> alterna tema claro u oscuro.{" "}
            <kbd className="px-1 rounded border border-ops-600 bg-ops-900 font-mono text-[10px]">Ctrl+K</kbd> abre la búsqueda global.
          </span>
          <button type="button" className="text-accent hover:underline shrink-0" onClick={dismissThemeHint}>
            Entendido
          </button>
        </div>
      )}
      <div className="h-12 flex items-center justify-between px-4 gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            type="button"
            className="md:hidden p-2 rounded-md hover:bg-ops-700 text-slate-400 min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
            aria-label="Abrir menú de navegación"
            onClick={() => onOpenMobileNav?.()}
          >
            <Menu className="w-5 h-5" />
          </button>
          {summary?.demoMode && (
            <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs rounded font-mono shrink-0">
              DEMO
            </span>
          )}
          <div className="hidden md:flex flex-col min-w-0 border-l border-ops-600 pl-3 ml-1">
            <span className="text-xs font-semibold text-slate-200 truncate">{title}</span>
            <span className="text-[10px] text-slate-600 tabular-nums">Última sync resumen: {lastSync}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <TopBarConnectorsMenu
              healthy={summary?.connectors.healthy ?? 0}
              total={summary?.connectors.total ?? 0}
              list={summary?.connectors.list ?? []}
            />
            {isFetching && <RefreshCw className="w-3 h-3 text-slate-600 animate-spin" aria-hidden />}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onOpenCommandPalette?.()}
            className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md border border-ops-600 bg-ops-800/80 text-xs text-slate-500 hover:border-ops-500 hover:text-slate-300 transition-colors min-h-[36px]"
            title="Buscar en todo el hub"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="max-w-[100px] truncate">Buscar…</span>
            <kbd className="ml-1 px-1 py-0.5 rounded border border-ops-600 text-[10px] text-slate-600 font-mono">⌘K</kbd>
          </button>

          <button
            type="button"
            onClick={() => toggleTheme()}
            className="p-2 rounded-md hover:bg-ops-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-slate-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-400" />
            )}
          </button>

          <div className="p-1 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <NotificationBell />
          </div>

          <div className="h-4 w-px bg-ops-600 hidden sm:block" />

          <UserMenu />
        </div>
      </div>
    </div>
  );
}
