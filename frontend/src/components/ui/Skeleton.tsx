import { cn } from "../../lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded bg-ops-700 relative overflow-hidden",
        "after:absolute after:inset-0 after:translate-x-[-100%]",
        "after:bg-gradient-to-r after:from-transparent after:via-white/5 after:to-transparent",
        "after:animate-[shimmer_1.5s_infinite]",
        className,
      )}
    />
  );
}

export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="bg-ops-800 border border-ops-600 rounded-lg p-4 space-y-3">
      <Skeleton className="h-4 w-2/3" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={cn("h-3", i % 2 === 0 ? "w-full" : "w-4/5")} />
      ))}
    </div>
  );
}
