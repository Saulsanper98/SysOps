import { useState, useEffect, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, apiError } from "../../lib/api";
import { useAuthStore, usePreferencesStore, DEFAULT_DASHBOARD_KPI_ORDER } from "../../store/useStore";
import { Card, CardBody } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { UserCircle, Save } from "lucide-react";
import toast from "react-hot-toast";

const DASH_WIDGET_OPTS: { id: string; label: string }[] = [
  { id: "dashboard-kpis", label: "Fila de KPI" },
  { id: "dashboard-top-alerts", label: "Top alertas" },
  { id: "dashboard-connectors", label: "Estado conectores" },
  { id: "dashboard-problems", label: "Sistemas con problemas" },
  { id: "dashboard-all-systems", label: "Cuadrícula de sistemas" },
  { id: "dashboard-activity", label: "Actividad reciente" },
];

export default function Profile() {
  const { user, setAuth } = useAuthStore();
  const oledMode = usePreferencesStore((s) => s.oledMode);
  const setOledMode = usePreferencesStore((s) => s.setOledMode);
  const experimentalUi = usePreferencesStore((s) => s.experimentalUi);
  const setExperimentalUi = usePreferencesStore((s) => s.setExperimentalUi);
  const dashboardHiddenWidgets = usePreferencesStore((s) => s.dashboardHiddenWidgets);
  const toggleDashboardWidget = usePreferencesStore((s) => s.toggleDashboardWidget);
  const setDashboardKpiOrder = usePreferencesStore((s) => s.setDashboardKpiOrder);
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");

  const isDirty = useMemo(
    () => displayName !== (user?.displayName ?? "") || email !== (user?.email ?? ""),
    [displayName, email, user?.displayName, user?.email],
  );

  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [isDirty]);

  const updateProfile = useMutation({
    mutationFn: () => api.patch(`/users/${user?.id}`, { displayName, email }).then((r) => r.data),
    onSuccess: (updated) => {
      if (user) setAuth({ ...user, ...updated }, localStorage.getItem("sysops_token") ?? "");
      toast.success("Perfil actualizado");
    },
    onError: (err) => toast.error(apiError(err)),
  });

  return (
    <div className="space-y-5 max-w-lg">
      <div>
        <h2 className="text-lg font-bold text-slate-100">Mi Perfil</h2>
        <p className="text-xs text-slate-500 mt-0.5">Actualiza tu información personal</p>
      </div>

      <Card>
        <CardBody className="space-y-5">
          <div>
            <p className="text-sm font-semibold text-slate-200">Apariencia y dashboard</p>
            <p className="text-xs text-slate-600 mt-0.5">Preferencias solo en este navegador</p>
          </div>

          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="text-sm text-slate-300">Modo OLED (fondo negro en tema oscuro)</span>
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-ops-600 bg-ops-800 text-accent focus:ring-accent"
              checked={oledMode}
              onChange={(e) => setOledMode(e.target.checked)}
            />
          </label>

          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="text-sm text-slate-300">UI experimental</span>
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-ops-600 bg-ops-800 text-accent focus:ring-accent"
              checked={experimentalUi}
              onChange={(e) => setExperimentalUi(e.target.checked)}
            />
          </label>

          <div className="space-y-2 pt-2 border-t border-ops-700">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Widgets del dashboard</p>
            <p className="text-xs text-slate-600">Desmarca para ocultar bloques en la página principal.</p>
            <div className="space-y-2">
              {DASH_WIDGET_OPTS.map(({ id, label }) => (
                <label key={id} className="flex items-center justify-between gap-3 cursor-pointer">
                  <span className="text-sm text-slate-400">{label}</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-ops-600 bg-ops-800 text-accent focus:ring-accent"
                    checked={!dashboardHiddenWidgets.includes(id)}
                    onChange={() => toggleDashboardWidget(id)}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDashboardKpiOrder([...DEFAULT_DASHBOARD_KPI_ORDER])}
            >
              Restaurar orden de KPI
            </Button>
          </div>
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-ops-600 flex items-center justify-center text-2xl font-bold text-slate-300 flex-shrink-0">
              {user?.displayName?.charAt(0)?.toUpperCase() ?? <UserCircle className="w-8 h-8" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">{user?.displayName}</p>
              <p className="text-xs text-slate-500">@{user?.username}</p>
              <p className="text-xs text-slate-600 capitalize mt-0.5">Rol: {user?.role}</p>
            </div>
          </div>

          <Input
            label="Nombre visible"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <div className="flex justify-end">
            <Button
              icon={<Save className="w-4 h-4" />}
              loading={updateProfile.isPending}
              onClick={() => updateProfile.mutate()}
            >
              Guardar cambios
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
