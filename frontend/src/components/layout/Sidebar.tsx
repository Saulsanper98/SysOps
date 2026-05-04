import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, AlertTriangle, Zap, BookOpen,
  ClipboardList, Settings, ChevronRight, Shield,
  Server, Users, KeyRound, Lock, PanelLeftClose, PanelLeftOpen,
  Bell, BarChart2, Plug,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useAuthStore, useSidebarStore } from "../../store/useStore";
import { useState, useEffect, Fragment, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { DashboardSummary } from "../../types";
import { Tooltip } from "../ui/Tooltip";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { to: "/systems", icon: Server, label: "Sistemas" },
  { to: "/incidents", icon: AlertTriangle, label: "Incidencias", badge: "incidents" as const },
  { to: "/alerts", icon: Bell, label: "Alertas", badge: "alerts" as const },
  { to: "/automations", icon: Zap, label: "Automatizaciones" },
  { to: "/kb", icon: BookOpen, label: "Base de Conocimiento" },
  { to: "/audit", icon: ClipboardList, label: "Auditoría" },
  { to: "/metrics", icon: BarChart2, label: "Métricas" },
];

interface SidebarProps {
  /** Cierra drawer móvil al navegar */
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const { user } = useAuthStore();
  const { collapsed, toggleSidebar } = useSidebarStore();
  const location = useLocation();
  const inSettings = location.pathname.startsWith("/settings");
  const [settingsOpen, setSettingsOpen] = useState(inSettings);

  useEffect(() => {
    if (inSettings) setSettingsOpen(true);
  }, [inSettings]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "[" || e.key === "]") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleSidebar]);

  const isAdmin = user?.role === "admin";

  // Shared cache with TopBar — no extra requests
  const { data: summary } = useQuery<DashboardSummary>({
    queryKey: ["dashboard-summary"],
    queryFn: () => api.get("/dashboard/summary").then((r) => r.data),
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const badgeCount: Record<string, number> = {
    incidents: summary?.incidents.open ?? 0,
    alerts: summary?.alerts.critical ?? 0,
  };

  const pulseAlerts = (summary?.alerts.critical ?? 0) >= 1;
  const pulseIncidents = (summary?.incidents.open ?? 0) > 8;

  const wrapCollapsed = (label: string, node: ReactNode) =>
    collapsed ? <Tooltip content={label} side="right">{node}</Tooltip> : node;

  return (
    <aside
      aria-label="Navegación principal"
      className={cn(
        "flex-shrink-0 bg-ops-950 border-r border-[color:var(--border-default)] flex flex-col transition-all duration-200",
        collapsed ? "w-14" : "w-60",
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "border-b border-ops-600 flex items-center",
          collapsed ? "justify-center py-4 px-0" : "px-4 py-4 gap-3",
        )}
      >
        <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center flex-shrink-0">
          <Shield className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div>
            <div className="text-sm font-bold text-slate-100 tracking-tight">SysOps Hub</div>
            <div className="text-xs text-slate-500">Sistemas</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto" role="navigation">
        {navItems.map(({ to, icon: Icon, label, exact, badge }) => {
          const count = badge ? (badgeCount[badge] ?? 0) : 0;
          const showPulse =
            count > 0 &&
            ((badge === "alerts" && pulseAlerts) || (badge === "incidents" && pulseIncidents));
          const link = (
            <NavLink
              to={to}
              end={exact}
              title={collapsed ? label : undefined}
              onClick={() => onNavigate?.()}
              className={({ isActive }) =>
                cn(
                  "relative flex items-center gap-3 px-3 py-2 rounded-[var(--radius-card)] text-sm transition-colors group border min-h-[40px]",
                  collapsed && "justify-center",
                  isActive
                    ? "bg-accent/10 text-accent border-[color:var(--border-active)]"
                    : "text-slate-400 hover:text-slate-200 hover:bg-ops-700 border-transparent",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn(
                      "w-4 h-4 flex-shrink-0",
                      isActive ? "text-accent" : "text-slate-500 group-hover:text-slate-300",
                    )}
                  />
                  {collapsed && count > 0 && (
                    <span
                      className={cn(
                        "absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500",
                        showPulse && "motion-safe:animate-pulse",
                      )}
                    />
                  )}
                  {!collapsed && <span className="flex-1">{label}</span>}
                  {!collapsed && count > 0 && (
                    <span
                      className={cn(
                        "tabular-nums flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/30",
                        showPulse && "motion-safe:animate-pulse",
                      )}
                    >
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                  {!collapsed && isActive && count === 0 && (
                    <ChevronRight className="w-3 h-3 text-accent/50" />
                  )}
                </>
              )}
            </NavLink>
          );
          return (
            <Fragment key={to}>
              {collapsed ? wrapCollapsed(label, link) : link}
            </Fragment>
          );
        })}
      </nav>

      {/* Bottom: settings + user + collapse toggle */}
      <div className="px-2 py-3 border-t border-ops-600 space-y-0.5">
        {/* Settings */}
        {collapsed ? (
          <NavLink
            to="/settings"
            title="Configuración"
            onClick={() => onNavigate?.()}
            className={cn(
              "flex items-center justify-center px-3 py-2 rounded-lg text-sm transition-colors border",
              inSettings
                ? "bg-accent/10 text-accent border-accent/20"
                : "text-slate-500 hover:text-slate-200 hover:bg-ops-700 border-transparent",
            )}
          >
            <Settings className="w-4 h-4 flex-shrink-0" />
          </NavLink>
        ) : (
          <>
            <button
              onClick={() => setSettingsOpen((o) => !o)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                inSettings
                  ? "bg-accent/10 text-accent"
                  : "text-slate-500 hover:text-slate-200 hover:bg-ops-700",
              )}
            >
              <Settings className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 text-left">Configuración</span>
              <ChevronRight className={cn("w-3 h-3 transition-transform", settingsOpen && "rotate-90")} />
            </button>

            {settingsOpen && (
              <div className="pl-4 space-y-0.5">
                <NavLink
                  to="/settings/profile"
                  onClick={() => onNavigate?.()}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors",
                      isActive ? "text-accent bg-accent/5" : "text-slate-500 hover:text-slate-300 hover:bg-ops-700",
                    )
                  }
                >
                  <Lock className="w-3 h-3" /> Mi Perfil / 2FA
                </NavLink>
                {isAdmin && (
                  <NavLink
                    to="/settings/users"
                    onClick={() => onNavigate?.()}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors",
                        isActive ? "text-accent bg-accent/5" : "text-slate-500 hover:text-slate-300 hover:bg-ops-700",
                      )
                    }
                  >
                    <Users className="w-3 h-3" /> Usuarios
                  </NavLink>
                )}
                {isAdmin && (
                  <NavLink
                    to="/settings/ssh"
                    onClick={() => onNavigate?.()}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors",
                        isActive ? "text-accent bg-accent/5" : "text-slate-500 hover:text-slate-300 hover:bg-ops-700",
                      )
                    }
                  >
                    <KeyRound className="w-3 h-3" /> SSH Credentials
                  </NavLink>
                )}
                {isAdmin && (
                  <NavLink
                    to="/settings/connectors"
                    onClick={() => onNavigate?.()}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors",
                        isActive ? "text-accent bg-accent/5" : "text-slate-500 hover:text-slate-300 hover:bg-ops-700",
                      )
                    }
                  >
                    <Plug className="w-3 h-3" /> Conectores
                  </NavLink>
                )}
              </div>
            )}
          </>
        )}

        {/* User info */}
        <div
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg mt-1",
            collapsed && "justify-center px-0",
          )}
          title={collapsed ? `${user?.displayName} (${user?.role})` : undefined}
        >
          <div className="w-7 h-7 rounded-full bg-ops-600 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-slate-300">
              {user?.displayName?.charAt(0)?.toUpperCase() ?? "?"}
            </span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-300 truncate">{user?.displayName}</div>
              <div className="text-xs text-slate-600 capitalize">{user?.role}</div>
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={toggleSidebar}
          title={collapsed ? "Expandir sidebar" : "Contraer sidebar"}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600",
            "hover:text-slate-300 hover:bg-ops-700 transition-colors text-xs",
            collapsed && "justify-center",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="w-4 h-4" />
          ) : (
            <>
              <PanelLeftClose className="w-4 h-4" />
              <span>Contraer</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
