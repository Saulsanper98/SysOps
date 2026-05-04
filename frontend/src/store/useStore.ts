import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      setAuth: (user, token) => {
        localStorage.setItem("sysops_token", token);
        set({ user, token });
      },
      clearAuth: () => {
        localStorage.removeItem("sysops_token");
        localStorage.removeItem("sysops_user");
        set({ user: null, token: null });
      },
      isAuthenticated: () => !!get().token && !!get().user,
    }),
    { name: "sysops_auth", partialize: (s) => ({ user: s.user, token: s.token }) },
  ),
);

interface SidebarState {
  collapsed: boolean;
  toggleSidebar: () => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      collapsed: false,
      toggleSidebar: () => set((s) => ({ collapsed: !s.collapsed })),
    }),
    { name: "sysops_sidebar" },
  ),
);

interface ThemeState {
  theme: "dark" | "light";
  toggleTheme: () => void;
}

const _applyThemeClasses = (mode: "dark" | "light") => {
  document.documentElement.classList.toggle("dark", mode === "dark");
  document.documentElement.classList.toggle("light", mode === "light");
  document.documentElement.style.colorScheme = mode === "dark" ? "dark" : "light";
};

const _initTheme = (): "dark" | "light" => {
  const saved = (localStorage.getItem("sysops-theme") as "dark" | "light") ?? "dark";
  _applyThemeClasses(saved);
  return saved;
};

export const useThemeStore = create<ThemeState>()((set) => ({
  theme: _initTheme(),
  toggleTheme: () =>
    set((s) => {
      const next = s.theme === "dark" ? "light" : "dark";
      localStorage.setItem("sysops-theme", next);
      _applyThemeClasses(next);
      return { theme: next };
    }),
}));

export type UiDensity = "comfortable" | "compact";
export type SystemsViewMode = "cards" | "table";

export interface IncidentSavedView {
  id: string;
  name: string;
  search: string;
  status: string;
  severity: string;
  assignedToMe: boolean;
}

interface PreferencesState {
  uiDensity: UiDensity;
  setUiDensity: (d: UiDensity) => void;
  /** Orden de IDs de widgets KPI en dashboard: alerts | systems | incidents | connectors */
  dashboardKpiOrder: string[];
  setDashboardKpiOrder: (order: string[]) => void;
  themeHintDismissed: boolean;
  dismissThemeHint: () => void;
  rememberedUsername: string;
  setRememberedUsername: (u: string) => void;
  systemsViewMode: SystemsViewMode;
  setSystemsViewMode: (m: SystemsViewMode) => void;
  systemsSavedView: string;
  setSystemsSavedView: (v: string) => void;
  auditViewMode: "list" | "timeline";
  setAuditViewMode: (m: "list" | "timeline") => void;
  automationHistoryStatus: string;
  setAutomationHistoryStatus: (s: string) => void;
  automationHistorySearch: string;
  setAutomationHistorySearch: (s: string) => void;
  /** Fondo negro puro en modo oscuro (AMOLED) */
  oledMode: boolean;
  setOledMode: (v: boolean) => void;
  /** IDs de widgets del dashboard a ocultar: alertsCard | systemsCard | ... */
  dashboardHiddenWidgets: string[];
  setDashboardHiddenWidgets: (ids: string[]) => void;
  toggleDashboardWidget: (id: string) => void;
  /** Rutas recientes en paleta de comandos */
  cmdPaletteRecent: { to: string; label: string }[];
  pushCmdPaletteRecent: (to: string, label: string) => void;
  /** Flags experimentales UI (solo cliente) */
  experimentalUi: boolean;
  setExperimentalUi: (v: boolean) => void;
  changelogSeenVersion: string;
  setChangelogSeenVersion: (v: string) => void;
  /** Vistas guardadas de filtros en la página Incidencias */
  incidentsSavedViews: IncidentSavedView[];
  pushIncidentsSavedView: (v: Omit<IncidentSavedView, "id">) => void;
  removeIncidentsSavedView: (id: string) => void;
}

/** Orden por defecto de tarjetas KPI en el dashboard */
export const DEFAULT_DASHBOARD_KPI_ORDER = ["alerts", "systems", "incidents", "connectors"] as const;

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      uiDensity: "comfortable",
      setUiDensity: (uiDensity) => set({ uiDensity }),
      dashboardKpiOrder: [...DEFAULT_DASHBOARD_KPI_ORDER],
      setDashboardKpiOrder: (dashboardKpiOrder) => set({ dashboardKpiOrder }),
      themeHintDismissed: false,
      dismissThemeHint: () => set({ themeHintDismissed: true }),
      rememberedUsername: "",
      setRememberedUsername: (rememberedUsername) => set({ rememberedUsername }),
      systemsViewMode: "cards",
      setSystemsViewMode: (systemsViewMode) => set({ systemsViewMode }),
      systemsSavedView: "",
      setSystemsSavedView: (systemsSavedView) => set({ systemsSavedView }),
      auditViewMode: "list",
      setAuditViewMode: (auditViewMode) => set({ auditViewMode }),
      automationHistoryStatus: "",
      setAutomationHistoryStatus: (automationHistoryStatus) => set({ automationHistoryStatus }),
      automationHistorySearch: "",
      setAutomationHistorySearch: (automationHistorySearch) => set({ automationHistorySearch }),
      oledMode: false,
      setOledMode: (oledMode) => set({ oledMode }),
      dashboardHiddenWidgets: [],
      setDashboardHiddenWidgets: (dashboardHiddenWidgets) => set({ dashboardHiddenWidgets }),
      toggleDashboardWidget: (id) =>
        set((s) => ({
          dashboardHiddenWidgets: s.dashboardHiddenWidgets.includes(id)
            ? s.dashboardHiddenWidgets.filter((x) => x !== id)
            : [...s.dashboardHiddenWidgets, id],
        })),
      cmdPaletteRecent: [],
      pushCmdPaletteRecent: (to, label) =>
        set((s) => {
          const next = [{ to, label }, ...s.cmdPaletteRecent.filter((r) => r.to !== to)].slice(0, 8);
          return { cmdPaletteRecent: next };
        }),
      experimentalUi: false,
      setExperimentalUi: (experimentalUi) => set({ experimentalUi }),
      changelogSeenVersion: "",
      setChangelogSeenVersion: (changelogSeenVersion) => set({ changelogSeenVersion }),
      incidentsSavedViews: [],
      pushIncidentsSavedView: (v) =>
        set((s) => ({
          incidentsSavedViews: [
            { ...v, id: globalThis.crypto?.randomUUID?.() ?? `v-${Date.now()}` },
            ...s.incidentsSavedViews,
          ].slice(0, 12),
        })),
      removeIncidentsSavedView: (id) =>
        set((s) => ({
          incidentsSavedViews: s.incidentsSavedViews.filter((x) => x.id !== id),
        })),
    }),
    {
      name: "sysops_preferences",
      partialize: (s) => ({
        uiDensity: s.uiDensity,
        dashboardKpiOrder: s.dashboardKpiOrder,
        themeHintDismissed: s.themeHintDismissed,
        rememberedUsername: s.rememberedUsername,
        systemsViewMode: s.systemsViewMode,
        systemsSavedView: s.systemsSavedView,
        auditViewMode: s.auditViewMode,
        automationHistoryStatus: s.automationHistoryStatus,
        automationHistorySearch: s.automationHistorySearch,
        oledMode: s.oledMode,
        dashboardHiddenWidgets: s.dashboardHiddenWidgets,
        cmdPaletteRecent: s.cmdPaletteRecent,
        experimentalUi: s.experimentalUi,
        changelogSeenVersion: s.changelogSeenVersion,
        incidentsSavedViews: s.incidentsSavedViews,
      }),
    },
  ),
);
