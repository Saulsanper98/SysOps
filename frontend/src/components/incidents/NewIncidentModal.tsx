import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, apiError } from "../../lib/api";
import { Dialog } from "../ui/Dialog";
import { Input, Textarea } from "../ui/Input";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import toast from "react-hot-toast";

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
  });

  const { mutate, isPending: isLoading } = useMutation({
    mutationFn: (data: typeof form) =>
      api.post("/incidents", {
        ...data,
        tags: data.tags ? data.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      }),
    onSuccess: () => {
      toast.success("Incidencia creada");
      onCreated();
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

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
          <Input label="Tags (separadas por coma)" value={form.tags} onChange={set("tags")} placeholder="nginx, prod, disco" />
        </div>
        <Input label="Impacto" value={form.impact} onChange={set("impact")} placeholder="Usuarios afectados, servicios impactados..." />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={isLoading}>Crear incidencia</Button>
        </div>
      </form>
    </Dialog>
  );
}
