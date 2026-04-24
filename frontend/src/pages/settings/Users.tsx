import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, apiError } from "../../lib/api";
import type { User, UserRole } from "../../types";
import { Card, CardHeader, CardTitle, CardBody } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Plus, Edit2, ToggleLeft, ToggleRight, KeyRound, Clock } from "lucide-react";
import { cn, timeAgo } from "../../lib/utils";
import { useAuthStore } from "../../store/useStore";
import toast from "react-hot-toast";

interface UserWithActive extends User {
  active?: boolean;
}

const roleColor: Record<UserRole, string> = {
  admin: "text-red-400 bg-red-500/10 border-red-500/30",
  tecnico: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  readonly: "text-slate-400 bg-slate-500/10 border-slate-500/30",
};

const roleOptions = [
  { value: "admin", label: "Admin" },
  { value: "tecnico", label: "Técnico" },
  { value: "readonly", label: "Solo lectura" },
];

const initialNewUser = {
  username: "",
  email: "",
  displayName: "",
  role: "tecnico" as UserRole,
  password: "",
};

export default function UsersPage() {
  const qc = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const [showNew, setShowNew] = useState(false);
  const [editUser, setEditUser] = useState<UserWithActive | null>(null);
  const [tempPassword, setTempPassword] = useState<{ password: string; name: string } | null>(null);
  const [newUser, setNewUser] = useState(initialNewUser);

  const { data: users, isLoading } = useQuery<UserWithActive[]>({
    queryKey: ["users"],
    queryFn: () => api.get("/users").then((r) => r.data),
  });

  const createUser = useMutation({
    mutationFn: (data: typeof newUser) => api.post("/users", data),
    onSuccess: () => {
      toast.success("Usuario creado");
      qc.invalidateQueries({ queryKey: ["users"] });
      setShowNew(false);
      setNewUser(initialNewUser);
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const updateUser = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<User> }) =>
      api.patch(`/users/${id}`, data),
    onSuccess: () => {
      toast.success("Usuario actualizado");
      qc.invalidateQueries({ queryKey: ["users"] });
      setEditUser(null);
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/users/${id}/active`, { active }),
    onSuccess: () => {
      toast.success("Estado actualizado");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const resetPassword = useMutation({
    mutationFn: (id: string) =>
      api.post(`/users/${id}/reset-password`).then((r) => r.data),
    onSuccess: (data, id) => {
      const u = users?.find((u) => u.id === id);
      setTempPassword({ password: data.temporaryPassword, name: u?.displayName ?? "Usuario" });
    },
    onError: (err) => toast.error(apiError(err)),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Usuarios</h2>
          <p className="text-xs text-slate-500 mt-0.5">{users?.length ?? 0} usuarios registrados</p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowNew(true)}>
          Nuevo usuario
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de usuarios</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {isLoading ? (
            <div className="py-10 text-center text-slate-600 text-sm">Cargando...</div>
          ) : (
            <>
              <div className="grid grid-cols-12 px-4 py-2 border-b border-ops-700 text-xs text-slate-600 uppercase tracking-wide font-medium">
                <div className="col-span-3">Usuario</div>
                <div className="col-span-3">Email</div>
                <div className="col-span-2">Rol</div>
                <div className="col-span-2">Estado</div>
                <div className="col-span-2">Últ. sesión</div>
              </div>
              <div className="divide-y divide-ops-700/50">
                {(users ?? []).map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <div key={u.id} className="grid grid-cols-12 px-4 py-3 items-center hover:bg-ops-750 transition-colors">
                      <div className="col-span-3 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-ops-600 flex items-center justify-center flex-shrink-0 text-sm font-bold text-slate-300">
                          {u.displayName?.charAt(0)?.toUpperCase() ?? "?"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-slate-200 truncate font-medium">{u.displayName}</p>
                          <p className="text-xs text-slate-500 truncate">@{u.username}</p>
                        </div>
                      </div>
                      <div className="col-span-3 text-xs text-slate-400 truncate">{u.email}</div>
                      <div className="col-span-2">
                        <Badge className={roleColor[u.role]}>{u.role}</Badge>
                      </div>
                      <div className="col-span-2">
                        <button
                          disabled={isSelf}
                          onClick={() => toggleActive.mutate({ id: u.id, active: !u.active })}
                          className={cn("flex items-center gap-1 text-xs", isSelf && "opacity-40 cursor-not-allowed")}
                          title={isSelf ? "No puedes modificarte a ti mismo" : ""}
                        >
                          {u.active !== false ? (
                            <><ToggleRight className="w-4 h-4 text-emerald-400" /><span className="text-emerald-400">Activo</span></>
                          ) : (
                            <><ToggleLeft className="w-4 h-4 text-slate-500" /><span className="text-slate-500">Inactivo</span></>
                          )}
                        </button>
                      </div>
                      <div className="col-span-2 flex items-center justify-between">
                        <span className="text-xs text-slate-600">
                          {u.lastLogin ? (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {timeAgo(u.lastLogin)}
                            </span>
                          ) : "—"}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            disabled={isSelf}
                            onClick={() => setEditUser(u)}
                            className={cn("p-1 rounded hover:bg-ops-600 text-slate-500 hover:text-slate-200 transition-colors", isSelf && "opacity-40 cursor-not-allowed")}
                            title="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            disabled={isSelf}
                            onClick={() => resetPassword.mutate(u.id)}
                            className={cn("p-1 rounded hover:bg-ops-600 text-slate-500 hover:text-amber-400 transition-colors", isSelf && "opacity-40 cursor-not-allowed")}
                            title="Resetear contraseña"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardBody>
      </Card>

      {/* New user modal */}
      {showNew && (
        <Dialog open title="Nuevo usuario" onClose={() => setShowNew(false)} size="md">
          <div className="space-y-4">
            <Input label="Username" value={newUser.username} onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))} />
            <Input label="Email" type="email" value={newUser.email} onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))} />
            <Input label="Nombre visible" value={newUser.displayName} onChange={(e) => setNewUser((p) => ({ ...p, displayName: e.target.value }))} />
            <Select
              label="Rol"
              value={newUser.role}
              onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value as UserRole }))}
              options={roleOptions}
            />
            <Input label="Contraseña" type="password" value={newUser.password} onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))} />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setShowNew(false)}>Cancelar</Button>
              <Button
                loading={createUser.isPending}
                onClick={() => createUser.mutate(newUser)}
              >
                Crear usuario
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Edit user modal */}
      {editUser && (
        <Dialog open title={`Editar: ${editUser.displayName}`} onClose={() => setEditUser(null)} size="md">
          <div className="space-y-4">
            <Input
              label="Nombre visible"
              value={editUser.displayName}
              onChange={(e) => setEditUser((p) => p ? { ...p, displayName: e.target.value } : p)}
            />
            <Input
              label="Email"
              type="email"
              value={editUser.email}
              onChange={(e) => setEditUser((p) => p ? { ...p, email: e.target.value } : p)}
            />
            <Select
              label="Rol"
              value={editUser.role}
              onChange={(e) => setEditUser((p) => p ? { ...p, role: e.target.value as UserRole } : p)}
              options={roleOptions}
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setEditUser(null)}>Cancelar</Button>
              <Button
                loading={updateUser.isPending}
                onClick={() =>
                  updateUser.mutate({
                    id: editUser.id,
                    data: { displayName: editUser.displayName, email: editUser.email, role: editUser.role },
                  })
                }
              >
                Guardar cambios
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Temp password modal */}
      {tempPassword && (
        <Dialog open title="Contraseña temporal" onClose={() => setTempPassword(null)} size="sm">
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Se ha generado una contraseña temporal para <strong className="text-slate-200">{tempPassword.name}</strong>.
              Compártela de forma segura.
            </p>
            <div className="p-3 bg-ops-950 rounded-lg border border-ops-600 font-mono text-sm text-accent text-center select-all">
              {tempPassword.password}
            </div>
            <p className="text-xs text-slate-500">El usuario deberá cambiarla en el próximo inicio de sesión.</p>
            <div className="flex justify-end">
              <Button onClick={() => setTempPassword(null)}>Cerrar</Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
