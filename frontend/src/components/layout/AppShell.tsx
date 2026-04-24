import { useEffect, useState } from "react";
import { Outlet, Navigate, useNavigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useAuthStore } from "../../store/useStore";
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
  const online = useOnlineStatus();

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-ops-900">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />

        {/* Offline indicator */}
        {!online && (
          <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-400">
            <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
            Sin conexión — mostrando datos en caché
          </div>
        )}

        {/* Password must change banner */}
        {user?.passwordMustChange && (
          <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-xs text-red-300">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
            <span>Por seguridad, debes cambiar tu contraseña antes de continuar.</span>
            <button
              onClick={() => navigate("/settings/profile")}
              className="ml-1 underline hover:text-red-200 transition-colors"
            >
              Ir a ajustes →
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#1a2540",
            color: "#f1f5f9",
            border: "1px solid #243352",
            borderRadius: "8px",
            fontSize: "13px",
          },
          success: { iconTheme: { primary: "#10b981", secondary: "#0a0e1a" } },
          error: { iconTheme: { primary: "#ef4444", secondary: "#0a0e1a" } },
        }}
      />
    </div>
  );
}
