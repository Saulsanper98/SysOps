import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, apiError } from "../../lib/api";
import { Card, CardBody } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import toast from "react-hot-toast";

interface TwoFactorStatus {
  enabled: boolean;
}

interface SetupData {
  qrDataUrl: string;
  secret: string;
}

export default function TwoFactor() {
  const qc = useQueryClient();
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [showDisable, setShowDisable] = useState(false);

  const { data: status, isLoading } = useQuery<TwoFactorStatus>({
    queryKey: ["2fa-status"],
    queryFn: () => api.get("/auth/2fa/status").then((r) => r.data),
  });

  const setup2fa = useMutation({
    mutationFn: () => api.post("/auth/2fa/setup").then((r) => r.data),
    onSuccess: (data: SetupData) => setSetupData(data),
    onError: (err) => toast.error(apiError(err)),
  });

  const verify2fa = useMutation({
    mutationFn: (code: string) => api.post("/auth/2fa/verify", { code }),
    onSuccess: () => {
      toast.success("2FA activado correctamente");
      setSetupData(null);
      setVerifyCode("");
      qc.invalidateQueries({ queryKey: ["2fa-status"] });
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const disable2fa = useMutation({
    mutationFn: (code: string) => api.post("/auth/2fa/disable", { code }),
    onSuccess: () => {
      toast.success("2FA desactivado");
      setShowDisable(false);
      setDisableCode("");
      qc.invalidateQueries({ queryKey: ["2fa-status"] });
    },
    onError: (err) => toast.error(apiError(err)),
  });

  if (isLoading) {
    return <div className="py-10 text-center text-slate-600 text-sm">Cargando...</div>;
  }

  return (
    <div className="space-y-5 max-w-lg">
      <div>
        <h2 className="text-lg font-bold text-slate-100">Autenticación de dos factores</h2>
        <p className="text-xs text-slate-500 mt-0.5">Añade una capa extra de seguridad a tu cuenta</p>
      </div>

      {/* Status card */}
      <Card>
        <CardBody>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${status?.enabled ? "bg-emerald-500/10" : "bg-slate-500/10"}`}>
              {status?.enabled ? (
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
              ) : (
                <ShieldOff className="w-6 h-6 text-slate-500" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-200">
                2FA está {status?.enabled ? "activado" : "desactivado"}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {status?.enabled
                  ? "Tu cuenta está protegida con autenticación TOTP."
                  : "Activa 2FA para mayor seguridad usando una app como Google Authenticator."}
              </p>
            </div>
            {!status?.enabled && !setupData && (
              <Button
                icon={<Smartphone className="w-4 h-4" />}
                loading={setup2fa.isPending}
                onClick={() => setup2fa.mutate()}
              >
                Activar 2FA
              </Button>
            )}
            {status?.enabled && !showDisable && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowDisable(true)}
              >
                Desactivar
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Setup flow: show QR */}
      {setupData && (
        <Card>
          <CardBody className="space-y-4">
            <p className="text-sm font-semibold text-slate-200">Escanea el código QR</p>
            <p className="text-xs text-slate-500">
              Abre tu app de autenticación (Google Authenticator, Authy...) y escanea el código QR.
            </p>
            <div className="flex justify-center p-4 bg-white rounded-lg">
              <img src={setupData.qrDataUrl} alt="QR Code 2FA" className="w-48 h-48" />
            </div>
            <div className="p-3 bg-ops-950 rounded border border-ops-600">
              <p className="text-xs text-slate-500 mb-1">Clave manual:</p>
              <p className="font-mono text-xs text-accent select-all">{setupData.secret}</p>
            </div>
            <Input
              label="Código de verificación (6 dígitos)"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value)}
              placeholder="123456"
              maxLength={6}
            />
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setSetupData(null)}>Cancelar</Button>
              <Button
                loading={verify2fa.isPending}
                disabled={verifyCode.length !== 6}
                onClick={() => verify2fa.mutate(verifyCode)}
              >
                Verificar y activar
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Disable flow */}
      {showDisable && (
        <Card>
          <CardBody className="space-y-4">
            <p className="text-sm font-semibold text-slate-200">Desactivar 2FA</p>
            <p className="text-xs text-slate-500">
              Introduce el código TOTP actual de tu app de autenticación para confirmar.
            </p>
            <Input
              label="Código TOTP actual"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value)}
              placeholder="123456"
              maxLength={6}
            />
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowDisable(false)}>Cancelar</Button>
              <Button
                variant="danger"
                loading={disable2fa.isPending}
                disabled={disableCode.length !== 6}
                onClick={() => disable2fa.mutate(disableCode)}
              >
                Desactivar 2FA
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
