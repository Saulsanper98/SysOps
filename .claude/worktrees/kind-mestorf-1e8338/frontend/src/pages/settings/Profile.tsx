import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, apiError } from "../../lib/api";
import { useAuthStore } from "../../store/useStore";
import { Card, CardBody } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { UserCircle, Save } from "lucide-react";
import toast from "react-hot-toast";

export default function Profile() {
  const { user, setAuth } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");

  const updateProfile = useMutation({
    mutationFn: () => api.patch(`/users/${user?.id}`, { displayName, email }).then((r) => r.data),
    onSuccess: (updated) => {
      if (user) setAuth({ ...user, ...updated }, localStorage.getItem("sysops_token") ?? "");
      toast.success("Perfil actualizado");
    },
    onError: (err) => toast.error(apiError(err)),
  });

  return (
    <div className="space-y-5 max-w-lg">
      <div>
        <h2 className="text-lg font-bold text-slate-100">Mi Perfil</h2>
        <p className="text-xs text-slate-500 mt-0.5">Actualiza tu información personal</p>
      </div>

      <Card>
        <CardBody className="space-y-5">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-ops-600 flex items-center justify-center text-2xl font-bold text-slate-300 flex-shrink-0">
              {user?.displayName?.charAt(0)?.toUpperCase() ?? <UserCircle className="w-8 h-8" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">{user?.displayName}</p>
              <p className="text-xs text-slate-500">@{user?.username}</p>
              <p className="text-xs text-slate-600 capitalize mt-0.5">Rol: {user?.role}</p>
            </div>
          </div>

          <Input
            label="Nombre visible"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <div className="flex justify-end">
            <Button
              icon={<Save className="w-4 h-4" />}
              loading={updateProfile.isPending}
              onClick={() => updateProfile.mutate()}
            >
              Guardar cambios
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
