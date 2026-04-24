import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "../store/useStore";
import { api, apiError } from "../lib/api";
import type { User } from "../types";
import toast from "react-hot-toast";

export default function AuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      toast.error("Login con Microsoft fallido: token no recibido");
      navigate("/login");
      return;
    }

    // Fetch the user profile using the token
    api
      .get<User>("/users/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => {
        setAuth(data, token);
        toast.success(`Bienvenido, ${data.displayName}`);
        navigate("/");
      })
      .catch((err) => {
        toast.error(apiError(err));
        navigate("/login");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-ops-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
        <p className="text-sm text-slate-500">Autenticando con Microsoft…</p>
      </div>
    </div>
  );
}
