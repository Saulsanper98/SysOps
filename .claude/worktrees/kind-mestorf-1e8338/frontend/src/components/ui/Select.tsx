import { cn } from "../../lib/utils";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, options, className, ...props }: SelectProps) {
  return (
    <div className="space-y-1">
      {label && <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</label>}
      <select
        className={cn(
          "w-full bg-ops-850 border border-ops-600 rounded px-3 py-2 text-sm text-slate-200",
          "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30",
          "transition-colors cursor-pointer",
          className,
        )}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-ops-800">
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
