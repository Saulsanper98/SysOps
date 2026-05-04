import { useEffect, useState } from "react";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import { cn } from "../../lib/utils";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { AppOutlet } from "./AppOutlet";
import { useAuthStore, usePreferencesStore } from "../../store/useStore";
import { ChangelogModal } from "../ChangelogModal";
import { CommandPalette } from "../search/CommandPalette";
import { KeyboardShortcutsOverlay } from "../help/KeyboardShortcutsOverlay";
import { Toaster } from "react-hot-toast";
import { WifiOff, AlertTriangle } from "lucide-react";

function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function AppShell() {
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const oledMode = usePreferencesStore((s) => s.oledMode);
  const online = useOnlineStatus();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.documentElement.classList.toggle("oled", oledMode);
    return () => document.documentElement.classList.remove("oled");
  }, [oledMode]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-ops-900 text-[color:var(--text-primary)]">
      <a href="#main-content" className="skip-link">
        Ir al contenido principal
      </a>
      {mobileNavOpen && (
        <div
          role="presentation"
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <div
        className={cn(
          "flex-shrink-0 z-50",
          mobileNavOpen ? "fixed inset-y-0 left-0 flex shadow-2xl" : "hidden",
          "md:relative md:z-auto md:flex md:shadow-none",
        )}
      >
        <Sidebar onNavigate={() => setMobileNavOpen(false)} />
      </div>
      <div className="flex-1 flex flex-col min-w-0 bg-[color:var(--surface-page)]">
        <header className="flex-shrink-0 flex flex-col" role="banner">
          <TopBar
            onOpenCommandPalette={() => setCmdOpen(true)}
            onOpenMobileNav={() => setMobileNavOpen(true)}
          />
        </header>

        {!online && (
          <div
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-400"
            role="status"
            aria-live="polite"
          >
            <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
            Sin conexión — mostrando datos en caché
          </div>
        )}

        {user?.passwordMustChange && (
          <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-xs text-red-300">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
            <span>Por seguridad, debes cambiar tu contraseña antes de continuar.</span>
            <button
              type="button"
              onClick={() => navigate("/settings/profile")}
              className="ml-1 underline hover:text-red-200 transition-colors"
            >
              Ir a ajustes →
            </button>
          </div>
        )}

        <main
          id="main-content"
          className="flex-1 overflow-y-auto flex flex-col min-h-0"
          tabIndex={-1}
        >
          <div className="mx-auto w-full max-w-content flex-1 flex flex-col min-h-0 border-l border-r border-transparent">
            <AppOutlet />
          </div>
        </main>
      </div>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      <KeyboardShortcutsOverlay />
      <Toaster
        position="bottom-right"
        containerClassName="!z-toast"
        toastOptions={{
          className: "!text-sm",
          style: {
            background: "var(--surface-raised)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-modal)",
            fontSize: "13px",
          },
          success: { iconTheme: { primary: "#10b981", secondary: "#0a0e1a" } },
          error: { iconTheme: { primary: "#ef4444", secondary: "#0a0e1a" } },
        }}
      />
      <div aria-live="polite" aria-atomic="true" className="sr-only" id="toast-aria-polite" />
      <ChangelogModal />
    </div>
  );
}
