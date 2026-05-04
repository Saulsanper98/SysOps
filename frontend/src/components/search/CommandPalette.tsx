import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Search, AlertTriangle, BookOpen, Server, X,
  LayoutDashboard, Zap, ClipboardList, BarChart2, Settings, Clock,
} from "lucide-react";
import { api } from "../../lib/api";
import type { Incident, KbArticle, SystemStatusItem } from "../../types";
import { cn, severityColor, severityLabel } from "../../lib/utils";
import type { Severity } from "../../types";
import { useDebounce } from "../../lib/hooks/useDebounce";
import { usePreferencesStore } from "../../store/useStore";

interface Result {
  id: string;
  section: string;
  label: string;
  sub?: string;
  badge?: string;
  badgeClass?: string;
  icon: React.ReactNode;
  to: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 250);
  const cmdPaletteRecent = usePreferencesStore((s) => s.cmdPaletteRecent);
  const pushCmdPaletteRecent = usePreferencesStore((s) => s.pushCmdPaletteRecent);

  const handleClose = useCallback(() => {
    setQuery("");
    onClose();
  }, [onClose]);

  const go = useCallback(
    (to: string, label: string) => {
      pushCmdPaletteRecent(to, label);
      navigate(to);
      handleClose();
    },
    [navigate, handleClose, pushCmdPaletteRecent],
  );

  const enabled = open && debouncedQuery.trim().length >= 2;

  const { data: incidents } = useQuery({
    queryKey: ["cmd-incidents", debouncedQuery],
    queryFn: () =>
      api.get("/incidents", { params: { search: debouncedQuery, limit: 5, status: "all" } })
        .then((r) => r.data.data as Incident[]),
    enabled,
    staleTime: 10000,
  });

  const { data: articles } = useQuery({
    queryKey: ["cmd-kb", debouncedQuery],
    queryFn: () =>
      api.get("/kb", { params: { search: debouncedQuery, limit: 5 } })
        .then((r) => r.data.data as KbArticle[]),
    enabled,
    staleTime: 10000,
  });

  // Systems come from dashboard cache — filter client-side
  const { data: systems } = useQuery<SystemStatusItem[]>({
    queryKey: ["dashboard-systems"],
    queryFn: () => api.get("/dashboard/systems").then((r) => r.data),
    staleTime: 30000,
    enabled: open,
  });

  const quickLinks: Result[] = useMemo(
    () => [
      { id: "q-dash", section: "Ir a", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4 text-accent" />, to: "/" },
      { id: "q-inc", section: "Ir a", label: "Incidencias", icon: <AlertTriangle className="w-4 h-4 text-amber-400" />, to: "/incidents" },
      { id: "q-sys", section: "Ir a", label: "Sistemas", icon: <Server className="w-4 h-4 text-blue-400" />, to: "/systems" },
      { id: "q-auto", section: "Ir a", label: "Automatizaciones", icon: <Zap className="w-4 h-4 text-yellow-400" />, to: "/automations" },
      { id: "q-kb", section: "Ir a", label: "Base de conocimiento", icon: <BookOpen className="w-4 h-4 text-emerald-400" />, to: "/kb" },
      { id: "q-audit", section: "Ir a", label: "Auditoría", icon: <ClipboardList className="w-4 h-4 text-slate-400" />, to: "/audit" },
      { id: "q-met", section: "Ir a", label: "Métricas", icon: <BarChart2 className="w-4 h-4 text-slate-400" />, to: "/metrics" },
      { id: "q-set", section: "Ir a", label: "Ajustes", icon: <Settings className="w-4 h-4 text-slate-400" />, to: "/settings/profile" },
    ],
    [],
  );

  const recentAsResults: Result[] = useMemo(
    () =>
      cmdPaletteRecent.map((r, idx) => ({
        id: `recent-${r.to}-${idx}`,
        section: "Recientes",
        label: r.label,
        icon: <Clock className="w-4 h-4 text-slate-500" />,
        to: r.to,
      })),
    [cmdPaletteRecent],
  );

  const shortcutsWithRecents = useMemo(() => {
    const seen = new Set<string>();
    const out: Result[] = [];
    for (const r of recentAsResults) {
      if (seen.has(r.to)) continue;
      seen.add(r.to);
      out.push(r);
    }
    for (const r of quickLinks) {
      if (seen.has(r.to)) continue;
      seen.add(r.to);
      out.push(r);
    }
    return out;
  }, [recentAsResults, quickLinks]);

  const results: Result[] = useMemo(() => {
    const out: Result[] = [];
    if (debouncedQuery.trim().length < 2) return shortcutsWithRecents;
    const q = debouncedQuery.toLowerCase();

    (incidents ?? []).forEach((inc) => {
      out.push({
        id: `inc-${inc.id}`,
        section: "Incidencias",
        label: inc.title,
        sub: inc.system?.name,
        badge: severityLabel[inc.severity as Severity],
        badgeClass: severityColor[inc.severity as Severity],
        icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
        to: `/incidents/${inc.id}`,
      });
    });

    (articles ?? []).forEach((art) => {
      out.push({
        id: `kb-${art.id}`,
        section: "Base de conocimiento",
        label: art.title,
        sub: art.summary ?? undefined,
        icon: <BookOpen className="w-4 h-4 text-amber-400" />,
        to: `/kb/${art.id}`,
      });
    });

    (systems ?? [])
      .filter((s) => s.name.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach((sys) => {
        out.push({
          id: `sys-${sys.externalId}`,
          section: "Sistemas",
          label: sys.name,
          sub: sys.type,
          badge: sys.status,
          badgeClass:
            sys.status === "critico"
              ? "text-red-400 bg-red-500/10 border-red-500/30"
              : sys.status === "degradado"
              ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
              : "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
          icon: <Server className="w-4 h-4 text-blue-400" />,
          to: "/systems",
        });
      });
    return out;
  }, [debouncedQuery, incidents, articles, systems, shortcutsWithRecents]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, Math.max(results.length - 1, 0)));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
      }
      if (e.key === "Enter" && results[selected]) {
        const r = results[selected];
        if ((e.metaKey || e.ctrlKey) && e.shiftKey === false) {
          window.open(r.to, "_blank", "noopener,noreferrer");
          pushCmdPaletteRecent(r.to, r.label);
          handleClose();
        } else {
          go(r.to, r.label);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, results, selected, go, handleClose, pushCmdPaletteRecent]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelected(0);
  }, [debouncedQuery]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-cmd-palette flex items-start justify-center pt-24 px-4 animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* Panel */}
      <div className="relative w-full max-w-xl bg-ops-800 border border-ops-500 rounded-xl shadow-2xl overflow-hidden animate-slide-up">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-ops-600">
          <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar incidencias, artículos KB, sistemas..."
            className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 outline-none"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-slate-600 hover:text-slate-400 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 text-xs text-slate-600 border border-ops-600 rounded">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {debouncedQuery.trim().length < 2 && (
            <p className="px-4 pt-3 pb-1 text-[11px] text-slate-600 border-b border-ops-700/80">
              Recientes y atajos. Escribe al menos 2 caracteres para buscar incidencias, KB y sistemas.
            </p>
          )}
          {debouncedQuery.trim().length >= 2 && results.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-600">
              Sin resultados para «{debouncedQuery}»
            </div>
          ) : (
            <div className="py-1">
              {(() => {
                let lastSec = "";
                return results.map((r, i) => {
                  const head = r.section !== lastSec;
                  lastSec = r.section;
                  return (
                    <div key={r.id}>
                      {head && (
                        <div className="px-4 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                          {r.section}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={(ev) => {
                          if (ev.metaKey || ev.ctrlKey) {
                            window.open(r.to, "_blank", "noopener,noreferrer");
                            pushCmdPaletteRecent(r.to, r.label);
                            handleClose();
                          } else {
                            go(r.to, r.label);
                          }
                        }}
                        onMouseEnter={() => setSelected(i)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                          i === selected ? "bg-ops-700" : "hover:bg-ops-750",
                        )}
                      >
                        <span className="flex-shrink-0">{r.icon}</span>
                        <span className="flex-1 min-w-0">
                          <span className="text-sm text-slate-200 truncate block">{r.label}</span>
                          {r.sub && <span className="text-xs text-slate-500 truncate block">{r.sub}</span>}
                        </span>
                        {r.badge && (
                          <span className={cn("px-1.5 py-0.5 rounded text-xs border flex-shrink-0", r.badgeClass)}>
                            {r.badge}
                          </span>
                        )}
                      </button>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-ops-700 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-700">
          <span><kbd className="px-1 border border-ops-600 rounded">↑↓</kbd> navegar</span>
          <span><kbd className="px-1 border border-ops-600 rounded">↵</kbd> abrir</span>
          <span className="hidden sm:inline">
            <kbd className="px-1 border border-ops-600 rounded">Ctrl</kbd>+<kbd className="px-1 border border-ops-600 rounded">clic</kbd> nueva pestaña
          </span>
          <span><kbd className="px-1 border border-ops-600 rounded">ESC</kbd> cerrar</span>
        </div>
      </div>
    </div>
  );
}
