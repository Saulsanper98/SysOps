import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, AlertTriangle, BookOpen, Server, X } from "lucide-react";
import { api } from "../../lib/api";
import type { Incident, KbArticle, SystemStatusItem } from "../../types";
import { cn, severityColor, severityLabel } from "../../lib/utils";
import type { Severity } from "../../types";

// Simple debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

interface Result {
  id: string;
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

  const results: Result[] = [];

  if (debouncedQuery.trim().length >= 2) {
    const q = debouncedQuery.toLowerCase();

    (incidents ?? []).forEach((inc) => {
      results.push({
        id: `inc-${inc.id}`,
        label: inc.title,
        sub: inc.system?.name,
        badge: severityLabel[inc.severity as Severity],
        badgeClass: severityColor[inc.severity as Severity],
        icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
        to: `/incidents/${inc.id}`,
      });
    });

    (articles ?? []).forEach((art) => {
      results.push({
        id: `kb-${art.id}`,
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
        results.push({
          id: `sys-${sys.externalId}`,
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
  }

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, results.length - 1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
      if (e.key === "Enter" && results[selected]) {
        navigate(results[selected].to);
        handleClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, results, selected]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keep selection in range
  useEffect(() => { setSelected(0); }, [debouncedQuery]);

  const handleClose = useCallback(() => {
    setQuery("");
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-24 px-4 animate-fade-in">
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
          {debouncedQuery.trim().length < 2 ? (
            <div className="py-10 text-center text-xs text-slate-600">
              Escribe al menos 2 caracteres para buscar
            </div>
          ) : results.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-600">
              Sin resultados para «{debouncedQuery}»
            </div>
          ) : (
            <div className="py-1">
              {results.map((r, i) => (
                <button
                  key={r.id}
                  onClick={() => { navigate(r.to); handleClose(); }}
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
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-ops-700 flex items-center gap-3 text-xs text-slate-700">
          <span><kbd className="px-1 border border-ops-600 rounded">↑↓</kbd> navegar</span>
          <span><kbd className="px-1 border border-ops-600 rounded">↵</kbd> abrir</span>
          <span><kbd className="px-1 border border-ops-600 rounded">ESC</kbd> cerrar</span>
        </div>
      </div>
    </div>
  );
}
