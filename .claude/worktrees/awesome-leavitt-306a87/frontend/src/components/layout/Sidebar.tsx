import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, AlertTriangle, Zap, BookOpen,
  ClipboardList, Settings, ChevronRight, Activity,
  Shield
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useAuthStore } from "../../store/useStore";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { to: "/incidents", icon: AlertTriangle, label: "Incidencias" },
  { to: "/automations", icon: Zap, label: "Automatizaciones" },
  { to: "/kb", icon: BookOpen, label: "Base de Conocimiento" },
  { to: "/audit", icon: ClipboardList, label: "Auditoría" },
];

export function Sidebar() {
  const { user } = useAuthStore();
  const location = useLocation();

  return (
    <aside className="w-60 flex-shrink-0 bg-ops-950 border-r border-ops-600 flex flex-col">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-ops-600">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-100 tracking-tight">SysOps Hub</div>
            <div className="text-xs text-slate-500">Sistemas</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors group",
                isActive
                  ? "bg-accent/10 text-accent border border-accent/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-ops-700 border border-transparent",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-accent" : "text-slate-500 group-hover:text-slate-300")} />
                <span className="flex-1">{label}</span>
                {isActive && <ChevronRight className="w-3 h-3 text-accent/50" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom: user + settings */}
      <div className="px-2 py-3 border-t border-ops-600 space-y-0.5">
        {user?.role === "admin" && (
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                isActive ? "bg-accent/10 text-accent" : "text-slate-500 hover:text-slate-200 hover:bg-ops-700",
              )
            }
          >
            <Settings className="w-4 h-4" />
            <span>Configuración</span>
          </NavLink>
        )}
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
          <div className="w-7 h-7 rounded-full bg-ops-600 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-slate-300">
              {user?.displayName?.charAt(0)?.toUpperCase() ?? "?"}
            </span>
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium text-slate-300 truncate">{user?.displayName}</div>
            <div className="text-xs text-slate-600 capitalize">{user?.role}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
