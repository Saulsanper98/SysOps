import { useEffect, useState } from "react";
import { X } from "lucide-react";

const ROWS: [string, string][] = [
  ["Ctrl / Cmd + K", "Paleta de comandos"],
  ["[ o ]", "Contraer / expandir barra lateral"],
  ["?", "Mostrar esta ayuda"],
  ["Esc", "Cerrar modales y paneles"],
  ["↑ / ↓", "Navegar en paleta de resultados"],
  ["Enter", "Abrir resultado seleccionado"],
];

export function KeyboardShortcutsOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        const t = e.target as HTMLElement;
        if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return;
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onCustom = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("sysops-open-shortcuts", onCustom as EventListener);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("sysops-open-shortcuts", onCustom as EventListener);
    };
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="kbd-help-title">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-md bg-ops-800 border border-ops-500 rounded-xl shadow-elev-3 p-5 animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h2 id="kbd-help-title" className="text-base font-semibold text-slate-100">
            Atajos de teclado
          </h2>
          <button type="button" className="p-1 rounded hover:bg-ops-700 text-slate-400" onClick={() => setOpen(false)} aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <ul className="space-y-2 text-sm">
          {ROWS.map(([k, desc]) => (
            <li key={k} className="flex justify-between gap-4 border-b border-ops-700/80 pb-2 last:border-0">
              <span className="text-slate-400">{desc}</span>
              <kbd className="shrink-0 px-2 py-0.5 rounded border border-ops-600 bg-ops-900 text-xs text-slate-200 font-mono">{k}</kbd>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
