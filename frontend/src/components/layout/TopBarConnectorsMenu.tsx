import { useState, useRef, useEffect } from "react";
import { Wifi, WifiOff, Copy, Check } from "lucide-react";
import type { ConnectorResult } from "../../types";
import { cn } from "../../lib/utils";

export function TopBarConnectorsMenu({
  healthy,
  total,
  list,
}: {
  healthy: number;
  total: number;
  list: ConnectorResult[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open]);

  const degraded = total - healthy;

  const copyErr = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-left hover:bg-ops-700/80 transition-colors border border-transparent hover:border-ops-600"
        aria-expanded={open}
        aria-haspopup="true"
      >
        {degraded === 0 ? (
          <Wifi className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
        ) : (
          <WifiOff className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
        )}
        <span className="text-xs text-slate-500">
          {total ? `${healthy}/${total} conectores` : "Cargando..."}
        </span>
      </button>
      {open && list.length > 0 && (
        <div className="absolute left-0 top-full mt-1 w-80 max-h-72 overflow-y-auto rounded-lg border border-ops-600 bg-ops-800 shadow-elev-2 z-dropdown py-1">
          {list.map((c) => (
            <div key={c.type} className="flex items-start gap-2 px-3 py-2 border-b border-ops-700/60 last:border-0">
              <span className={cn("mt-1.5 w-2 h-2 rounded-full flex-shrink-0", c.healthy ? "bg-emerald-500" : "bg-red-500")} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-200">{c.displayName}</p>
                {c.healthy ? (
                  <p className="text-xs text-slate-500 font-mono tabular-nums">{c.latencyMs ?? "—"} ms</p>
                ) : (
                  <p className="text-xs text-red-400 break-words">{c.error ?? "Error"}</p>
                )}
              </div>
              {!c.healthy && c.error && (
                <button
                  type="button"
                  className="p-1 text-slate-500 hover:text-accent flex-shrink-0"
                  title="Copiar error"
                  onClick={() => copyErr(c.error ?? "", c.type)}
                >
                  {copied === c.type ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
