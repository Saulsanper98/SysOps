import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="breadcrumb" className="flex items-center gap-1 text-xs text-slate-600 mb-1">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="w-3 h-3 text-slate-700" />}
          {item.to ? (
            <Link to={item.to} className="hover:text-slate-400 transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-slate-400 truncate max-w-48">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
