import { NavLink, Outlet } from "react-router-dom";
import { Users, KeyRound, ShieldCheck, UserCircle } from "lucide-react";
import { useAuthStore } from "../../store/useStore";
import { cn } from "../../lib/utils";

const navItems = [
  { to: "/settings/profile", label: "Mi Perfil", icon: UserCircle, adminOnly: false },
  { to: "/settings/2fa", label: "Autenticación 2FA", icon: ShieldCheck, adminOnly: false },
  { to: "/settings/users", label: "Usuarios", icon: Users, adminOnly: true },
  { to: "/settings/ssh", label: "Credenciales SSH", icon: KeyRound, adminOnly: true },
];

export default function SettingsLayout() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";

  return (
    <div className="flex h-full animate-fade-in">
      {/* Side nav */}
      <aside className="w-52 flex-shrink-0 border-r border-ops-600 bg-ops-950 p-3 space-y-0.5">
        <p className="px-3 py-1 text-xs font-semibold text-slate-600 uppercase tracking-wider">
          Configuración
        </p>
        {navItems
          .filter((item) => !item.adminOnly || isAdmin)
          .map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-accent/10 text-accent border border-accent/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-ops-700 border border-transparent",
                )
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-5">
        <Outlet />
      </main>
    </div>
  );
}
