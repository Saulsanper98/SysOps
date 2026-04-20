import { Outlet, Navigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useAuthStore } from "../../store/useStore";
import { Toaster } from "react-hot-toast";

export function AppShell() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-ops-900">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
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
