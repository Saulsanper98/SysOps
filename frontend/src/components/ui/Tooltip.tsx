import { useId, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  side?: "right" | "top" | "bottom";
  className?: string;
}

export function Tooltip({ content, children, side = "right", className }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open || !anchorRef.current) return;
    const el = anchorRef.current;
    const r = el.getBoundingClientRect();
    const pad = 8;
    if (side === "right") {
      setPos({ top: r.top + r.height / 2, left: r.right + pad });
    } else if (side === "bottom") {
      setPos({ top: r.bottom + pad, left: r.left + r.width / 2 });
    } else {
      setPos({ top: r.top - pad, left: r.left + r.width / 2 });
    }
  }, [open, side]);

  const tip = open && content ? (
    <div
      role="tooltip"
      id={id}
      className={cn(
        "fixed z-tooltip pointer-events-none px-2 py-1 rounded-md text-xs font-medium max-w-xs",
        "bg-ops-700 text-slate-100 border border-ops-500 shadow-elev-2",
        side === "right" && "-translate-y-1/2",
        side === "bottom" && "-translate-x-1/2",
        side === "top" && "-translate-x-1/2 -translate-y-full",
        className,
      )}
      style={{ top: pos.top, left: pos.left }}
    >
      {content}
    </div>
  ) : null;

  return (
    <span
      ref={anchorRef}
      className="inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined}>{children}</span>
      {typeof document !== "undefined" && tip ? createPortal(tip, document.body) : null}
    </span>
  );
}
