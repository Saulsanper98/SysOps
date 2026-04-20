import { cn } from "../../lib/utils";
import type { Severity, SystemStatus } from "../../types";
import { severityDot, systemStatusDot } from "../../lib/utils";

export function SeverityDot({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <span className={cn("inline-block w-2 h-2 rounded-full flex-shrink-0", severityDot[severity], severity === "critica" && "animate-pulse", className)} />
  );
}

export function StatusDot({ status, className }: { status: SystemStatus; className?: string }) {
  return (
    <span className={cn("inline-block w-2 h-2 rounded-full flex-shrink-0", systemStatusDot[status], className)} />
  );
}
