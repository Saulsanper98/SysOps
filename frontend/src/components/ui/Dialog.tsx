import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizes = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function Dialog({ open, onClose, title, children, size = "md" }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Escape key handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Focus trap + return focus on close
  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement;

    const dialog = dialogRef.current;
    if (!dialog) return;

    // Focus first focusable element
    const focusables = dialog.querySelectorAll<HTMLElement>(FOCUSABLE);
    focusables[0]?.focus();

    const trapFocus = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const els = dialog.querySelectorAll<HTMLElement>(FOCUSABLE);
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };

    dialog.addEventListener("keydown", trapFocus);
    return () => {
      dialog.removeEventListener("keydown", trapFocus);
      previousFocusRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      aria-modal="true"
      role="dialog"
      aria-labelledby="dialog-title"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={dialogRef}
        className={cn("relative w-full bg-ops-800 border border-ops-500 rounded-xl shadow-2xl animate-slide-up", sizes[size])}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-ops-600">
          <h2 id="dialog-title" className="text-base font-semibold text-slate-100">{title}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
