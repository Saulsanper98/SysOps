import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, User, Settings } from "lucide-react";
import { useAuthStore } from "../../store/useStore";
import { api } from "../../lib/api";
import toast from "react-hot-toast";

export function UserMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open]);

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // ignore
    }
    clearAuth();
    navigate("/login");
    toast.success("Sesión cerrada");
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-ops-700 transition-colors min-h-[36px] min-w-[36px]"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <div className="w-7 h-7 rounded-full bg-ops-600 flex items-center justify-center text-xs font-bold text-slate-300">
          {user?.displayName?.charAt(0)?.toUpperCase() ?? "?"}
        </div>
        <span className="text-xs text-slate-400 max-w-[120px] truncate hidden sm:inline">{user?.displayName}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 w-52 rounded-lg border border-ops-600 bg-ops-800 shadow-elev-2 z-dropdown py-1"
        >
          <button
            type="button"
            role="menuitem"
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-slate-300 hover:bg-ops-750"
            onClick={() => {
              setOpen(false);
              navigate("/settings/profile");
            }}
          >
            <User className="w-4 h-4 text-slate-500" /> Mi perfil
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-slate-300 hover:bg-ops-750"
            onClick={() => {
              setOpen(false);
              navigate("/settings");
            }}
          >
            <Settings className="w-4 h-4 text-slate-500" /> Ajustes
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-slate-300 hover:bg-ops-750"
            onClick={() => {
              setOpen(false);
              window.dispatchEvent(new CustomEvent("sysops-open-shortcuts"));
            }}
          >
            Atajos de teclado (?)
          </button>
          <div className="h-px bg-ops-700 my-1" />
          <button
            type="button"
            role="menuitem"
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-red-400 hover:bg-ops-750"
            onClick={() => {
              setOpen(false);
              void logout();
            }}
          >
            <LogOut className="w-4 h-4" /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
