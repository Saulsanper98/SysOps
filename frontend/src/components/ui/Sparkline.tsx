import { cn } from "../../lib/utils";

export function Sparkline({
  values,
  color = "#3b82f6",
  height = 28,
  className,
}: {
  values: number[];
  color?: string;
  height?: number;
  className?: string;
}) {
  if (!values.length) return <div className={cn("w-full rounded bg-ops-700/50", className)} style={{ height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 120;
  const pad = 2;
  const pts = values.map((v, i) => {
    const x = pad + (i / Math.max(values.length - 1, 1)) * (w - pad * 2);
    const y = height - pad - ((v - min) / span) * (height - pad * 2);
    return `${x},${y}`;
  });
  const d = `M ${pts.join(" L ")}`;

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      className={cn("w-full max-w-[120px]", className)}
      style={{ height }}
      preserveAspectRatio="none"
      aria-hidden
    >
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
