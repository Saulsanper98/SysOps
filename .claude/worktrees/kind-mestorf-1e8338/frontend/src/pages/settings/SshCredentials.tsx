import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, apiError } from "../../lib/api";
import type { SshCredential } from "../../types";
import { Card, CardHeader, CardTitle, CardBody } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { Plus, Edit2, Trash2, Wifi, AlertTriangle } from "lucide-react";
import { cn, timeAgo } from "../../lib/utils";
import toast from "react-hot-toast";
import { Textarea } from "../../components/ui/Input";

const initialForm = {
  name: "",
  host: "",
  port: "22",
  username: "",
  privateKey: "",
  passphrase: "",
  description: "",
};

export default function SshCredentials() {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [editCred, setEditCred] = useState<SshCredential | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [testResult, setTestResult] = useState<{ id: string; result: string } | null>(null);

  const { data: creds, isLoading } = useQuery<SshCredential[]>({
    queryKey: ["ssh-credentials"],
    queryFn: () => api.get("/ssh-credentials").then((r) => r.data),
  });

  const createCred = useMutation({
    mutationFn: (data: typeof form) =>
      api.post("/ssh-credentials", { ...data, port: Number(data.port) }),
    onSuccess: () => {
      toast.success("Credencial creada");
      qc.invalidateQueries({ queryKey: ["ssh-credentials"] });
      setShowNew(false);
      setForm(initialForm);
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const updateCred = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof form> }) =>
      api.patch(`/ssh-credentials/${id}`, { ...data, port: data.port ? Number(data.port) : undefined }),
    onSuccess: () => {
      toast.success("Credencial actualizada");
      qc.invalidateQueries({ queryKey: ["ssh-credentials"] });
      setEditCred(null);
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const deleteCred = useMutation({
    mutationFn: (id: string) => api.delete(`/ssh-credentials/${id}`),
    onSuccess: () => {
      toast.success("Credencial eliminada");
      qc.invalidateQueries({ queryKey: ["ssh-credentials"] });
      setDeleteId(null);
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const testCred = useMutation({
    mutationFn: (id: string) => api.post(`/ssh-credentials/${id}/test`).then((r) => r.data),
    onSuccess: (data, id) => {
      const msg = data.success ? "Conexión exitosa" : `Error: ${data.error}`;
      setTestResult({ id, result: msg });
      if (data.success) toast.success(msg);
      else toast.error(msg);
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const setEditForm = (cred: SshCredential) => {
    setEditCred(cred);
    setForm({
      name: cred.name,
      host: cred.host,
      port: String(cred.port),
      username: cred.username,
      privateKey: "",
      passphrase: "",
      description: cred.description ?? "",
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Credenciales SSH</h2>
          <p className="text-xs text-slate-500 mt-0.5">{creds?.length ?? 0} credenciales configuradas</p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => { setShowNew(true); setForm(initialForm); }}>
          Nueva credencial
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Credenciales configuradas</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {isLoading ? (
            <div className="py-10 text-center text-slate-600 text-sm">Cargando...</div>
          ) : !creds?.length ? (
            <div className="py-12 text-center text-slate-600 text-sm">Sin credenciales configuradas</div>
          ) : (
            <div className="divide-y divide-ops-700/50">
              {creds.map((cred) => (
                <div key={cred.id} className="flex items-center gap-4 px-4 py-3 hover:bg-ops-750 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-200">{cred.name}</p>
                      <span className={cn(
                        "text-xs px-1.5 py-0.5 rounded border",
                        cred.active
                          ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                          : "text-slate-500 bg-slate-500/10 border-slate-500/30",
                      )}>
                        {cred.active ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 font-mono">
                      {cred.username}@{cred.host}:{cred.port}
                    </p>
                    {cred.description && (
                      <p className="text-xs text-slate-600 mt-0.5">{cred.description}</p>
                    )}
                    {testResult?.id === cred.id && (
                      <p className={cn("text-xs mt-1", testResult.result.startsWith("Error") ? "text-red-400" : "text-emerald-400")}>
                        {testResult.result}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-slate-600">{timeAgo(cred.createdAt)}</p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="xs"
                      icon={<Wifi className="w-3.5 h-3.5" />}
                      loading={testCred.isPending && testCred.variables === cred.id}
                      onClick={() => testCred.mutate(cred.id)}
                      title="Probar conexión"
                    >
                      Probar
                    </Button>
                    <button
                      onClick={() => setEditForm(cred)}
                      className="p-1.5 rounded hover:bg-ops-600 text-slate-500 hover:text-slate-200 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteId(cred.id)}
                      className="p-1.5 rounded hover:bg-ops-600 text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Create/Edit modal */}
      {(showNew || editCred) && (
        <Dialog
          open
          title={editCred ? `Editar: ${editCred.name}` : "Nueva credencial SSH"}
          onClose={() => { setShowNew(false); setEditCred(null); }}
          size="lg"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Nombre" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              <Input label="Usuario" value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Input label="Host" value={form.host} onChange={(e) => setForm((p) => ({ ...p, host: e.target.value }))} placeholder="192.168.1.1" />
              </div>
              <Input label="Puerto" type="number" value={form.port} onChange={(e) => setForm((p) => ({ ...p, port: e.target.value }))} />
            </div>
            <Textarea
              label="Clave privada (PEM)"
              value={form.privateKey}
              onChange={(e) => setForm((p) => ({ ...p, privateKey: e.target.value }))}
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;..."
              className="min-h-[120px] font-mono text-xs"
            />
            <Input
              label="Passphrase (opcional)"
              type="password"
              value={form.passphrase}
              onChange={(e) => setForm((p) => ({ ...p, passphrase: e.target.value }))}
            />
            <Input
              label="Descripción (opcional)"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => { setShowNew(false); setEditCred(null); }}>Cancelar</Button>
              <Button
                loading={createCred.isPending || updateCred.isPending}
                onClick={() => {
                  if (editCred) updateCred.mutate({ id: editCred.id, data: form });
                  else createCred.mutate(form);
                }}
              >
                {editCred ? "Guardar cambios" : "Crear credencial"}
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <Dialog open title="Confirmar eliminación" onClose={() => setDeleteId(null)} size="sm">
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">Esta acción eliminará la credencial permanentemente.</p>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancelar</Button>
              <Button variant="danger" loading={deleteCred.isPending} onClick={() => deleteCred.mutate(deleteId)}>
                Eliminar
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
