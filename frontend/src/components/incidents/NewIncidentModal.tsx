import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, apiError } from "../../lib/api";
import { Dialog } from "../ui/Dialog";
import { Input, Textarea } from "../ui/Input";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import { Plus, X } from "lucide-react";
import toast from "react-hot-toast";
import type { User } from "../../types";

interface SystemOption { id: string; name: string; }

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export function NewIncidentModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    severity: "media",
    impact: "",
    tags: "",
    systemId: "",
    assignedTo: "",
  });
  const [checklistInput, setChecklistInput] = useState("");
  const [checklist, setChecklist] = useState<string[]>([]);

  const { data: systems } = useQuery<SystemOption[]>({
    queryKey: ["systems-minimal"],
    queryFn: () => api.get("/systems").then((r) =>
      (r.data as any[]).map((s) => ({ id: s.id, name: s.name }))
    ),
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: () => api.get("/users").then((r) => r.data),
  });

  const { mutate, isPending: isLoading } = useMutation({
    mutationFn: (data: typeof form) =>
      api.post("/incidents", {
        ...data,
        systemId: data.systemId || undefined,
        assignedTo: data.assignedTo || undefined,
        tags: data.tags ? data.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        checklist,
      }),
    onSuccess: () => {
      toast.success("Incidencia creada");
      onCreated();
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const addChecklistItem = () => {
    const item = checklistInput.trim();
    if (item) { setChecklist((c) => [...c, item]); setChecklistInput(""); }
  };

  return (
    <Dialog open title="Nueva Incidencia" onClose={onClose} size="lg">
      <form
        onSubmit={(e) => { e.preventDefault(); mutate(form); }}
        className="space-y-4"
      >
        <Input label="Título *" value={form.title} onChange={set("title")} placeholder="Descripción breve del problema" required />
        <Textarea label="Descripción" value={form.description} onChange={set("description") as any} placeholder="Detalla el problema, síntomas observados..." rows={3} />

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Severidad *"
            value={form.severity}
            onChange={set("severity") as any}
            options={[
              { value: "critica", label: "Crítica" },
              { value: "alta", label: "Alta" },
              { value: "media", label: "Media" },
              { value: "baja", label: "Baja" },
              { value: "info", label: "Info" },
            ]}
          />
          <Select
            label="Sistema"
            value={form.systemId}
            onChange={set("systemId") as any}
            options={[
              { value: "", label: "Sin sistema" },
              ...(systems ?? []).map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Asignar a"
            value={form.assignedTo}
            onChange={set("assignedTo") as any}
            options={[
              { value: "", label: "Sin asignar" },
              ...(users ?? []).filter((u) => u.active !== false).map((u) => ({ value: u.id, label: u.displayName })),
            ]}
          />
          <Input label="Tags (separadas por coma)" value={form.tags} onChange={set("tags")} placeholder="nginx, prod, disco" />
        </div>

        <Input label="Impacto" value={form.impact} onChange={set("impact")} placeholder="Usuarios afectados, servicios impactados..." />

        {/* Checklist */}
        <div>
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Checklist de resolución</label>
          <div className="flex gap-2 mt-1.5">
            <input
              value={checklistInput}
              onChange={(e) => setChecklistInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addChecklistItem())}
              placeholder="Añadir tarea... (Enter para agregar)"
              className="flex-1 bg-ops-850 border border-ops-600 rounded px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-accent"
            />
            <Button type="button" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={addChecklistItem}>
              Añadir
            </Button>
          </div>
          {checklist.length > 0 && (
            <ul className="mt-2 space-y-1">
              {checklist.map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="text-slate-600">•</span>
                  <span className="flex-1">{item}</span>
                  <button type="button" onClick={() => setChecklist((c) => c.filter((_, j) => j !== i))} className="text-slate-600 hover:text-red-400 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={isLoading}>Crear incidencia</Button>
        </div>
      </form>
    </Dialog>
  );
}
