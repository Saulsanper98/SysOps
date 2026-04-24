import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"; // Navigate kept for settings redirect
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "./components/layout/AppShell";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Incidents from "./pages/Incidents";
import IncidentDetail from "./pages/IncidentDetail";
import Automations from "./pages/Automations";
import KB from "./pages/KB";
import KBArticle from "./pages/KBArticle";
import KBEditor from "./pages/KBEditor";
import Notifications from "./pages/Notifications";
import AuthCallback from "./pages/AuthCallback";
import Audit from "./pages/Audit";
import Systems from "./pages/Systems";
import NotFound from "./pages/NotFound";
import SettingsLayout from "./pages/settings/index";
import UsersPage from "./pages/settings/Users";
import SshCredentials from "./pages/settings/SshCredentials";
import TwoFactor from "./pages/settings/TwoFactor";
import Profile from "./pages/settings/Profile";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<AppShell />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/incidents" element={<Incidents />} />
            <Route path="/incidents/:id" element={<IncidentDetail />} />
            <Route path="/automations" element={<Automations />} />
            <Route path="/kb" element={<KB />} />
            <Route path="/kb/new" element={<KBEditor />} />
            <Route path="/kb/:id" element={<KBArticle />} />
            <Route path="/kb/:id/edit" element={<KBEditor />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/audit" element={<Audit />} />
            <Route path="/systems" element={<Systems />} />
            <Route path="/settings" element={<SettingsLayout />}>
              <Route index element={<Navigate to="/settings/profile" replace />} />
              <Route path="profile" element={<Profile />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="ssh" element={<SshCredentials />} />
              <Route path="2fa" element={<TwoFactor />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="/auth/callback" element={<AuthCallback />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
