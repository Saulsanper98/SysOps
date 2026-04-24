import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import type { Severity, IncidentStatus, AutomationStatus, SystemStatus } from "../types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function timeAgo(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: es });
}

export function formatDate(date: string | Date, fmt = "dd/MM/yyyy HH:mm"): string {
  return format(new Date(date), fmt, { locale: es });
}

export const severityLabel: Record<Severity, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Media",
  baja: "Baja",
  info: "Info",
};

export const severityColor: Record<Severity, string> = {
  critica: "text-red-400 bg-red-500/10 border-red-500/30",
  alta: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  media: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  baja: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  info: "text-slate-400 bg-slate-500/10 border-slate-500/30",
};

export const severityDot: Record<Severity, string> = {
  critica: "bg-red-500",
  alta: "bg-orange-500",
  media: "bg-amber-500",
  baja: "bg-blue-500",
  info: "bg-slate-500",
};

export const incidentStatusLabel: Record<IncidentStatus, string> = {
  abierta: "Abierta",
  en_progreso: "En progreso",
  pendiente: "Pendiente",
  resuelta: "Resuelta",
  cerrada: "Cerrada",
};

export const incidentStatusColor: Record<IncidentStatus, string> = {
  abierta: "text-red-400 bg-red-500/10 border-red-500/30",
  en_progreso: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  pendiente: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  resuelta: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  cerrada: "text-slate-400 bg-slate-500/10 border-slate-500/30",
};

export const automationStatusColor: Record<AutomationStatus, string> = {
  pendiente: "text-slate-400 bg-slate-500/10 border-slate-500/30",
  ejecutando: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  completada: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  fallida: "text-red-400 bg-red-500/10 border-red-500/30",
  cancelada: "text-slate-400 bg-slate-500/10 border-slate-500/30",
};

export const systemStatusColor: Record<SystemStatus, string> = {
  ok: "text-emerald-400",
  degradado: "text-amber-400",
  critico: "text-red-400",
  desconocido: "text-slate-400",
};

export const systemStatusDot: Record<SystemStatus, string> = {
  ok: "bg-emerald-500",
  degradado: "bg-amber-500",
  critico: "bg-red-500 animate-pulse",
  desconocido: "bg-slate-500",
};
