import { cn } from "../../lib/utils";
import { Button } from "./Button";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void; icon?: React.ReactNode };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-4 py-16 text-center", className)}>
      <div className="w-14 h-14 rounded-2xl bg-ops-750 border border-ops-600 flex items-center justify-center text-slate-600">
        {icon}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-slate-400">{title}</p>
        {description && <p className="text-xs text-slate-600 max-w-xs mx-auto">{description}</p>}
      </div>
      {action && (
        <Button variant="outline" size="sm" icon={action.icon} onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
