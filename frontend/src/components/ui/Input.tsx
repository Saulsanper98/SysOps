import { useId } from "react";
import { cn } from "../../lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export function Input({ label, error, icon, className, id: externalId, ...props }: InputProps) {
  const generatedId = useId();
  const id = externalId ?? generatedId;
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-slate-400 uppercase tracking-wide">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
            {icon}
          </div>
        )}
        <input
          id={id}
          className={cn(
            "w-full bg-ops-850 border border-ops-600 rounded px-3 py-2 text-sm text-slate-200",
            "placeholder:text-slate-600 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30",
            "transition-colors",
            icon && "pl-9",
            error && "border-red-500/60",
            className,
          )}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className, id: externalId, ...props }: TextareaProps) {
  const generatedId = useId();
  const id = externalId ?? generatedId;
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-slate-400 uppercase tracking-wide">
          {label}
        </label>
      )}
      <textarea
        id={id}
        className={cn(
          "w-full bg-ops-850 border border-ops-600 rounded px-3 py-2 text-sm text-slate-200 resize-y min-h-[80px]",
          "placeholder:text-slate-600 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30",
          "transition-colors",
          error && "border-red-500/60",
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
