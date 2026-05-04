import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiError } from "../../lib/api";
import { Card, CardBody, CardHeader, CardTitle } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { cn } from "../../lib/utils";
import toast from "react-hot-toast";
import { Loader2, Plug, Trash2, FlaskConical } from "lucide-react";

const SECRET_KEYS = new Set(["password", "apiKey", "privateKey", "token"]);

type ConnectorType =
  | "zabbix"
  | "uptime_kuma"
  | "proxmox"
  | "vcenter"
  | "portainer"
  | "nas"
  | "qnap"
  | "hikvision"
  | "m365";

interface ConnectorRow {
  type: ConnectorType;
  enabled: boolean;
  payloadMasked: Record<string, unknown>;
}

const DEFS: Record<
  ConnectorType,
  { title: string; hint: string; fields: { key: string; label: string; type?: "url" | "password" | "checkbox" }[] }
> = {
  zabbix: {
    title: "Zabbix",
    hint: "URL base del servidor (sin path /api_jsonrpc).",
    fields: [
      { key: "url", label: "URL", type: "url" },
      { key: "user", label: "Usuario" },
      { key: "password", label: "Contraseña", type: "password" },
    ],
  },
  uptime_kuma: {
    title: "Uptime Kuma",
    hint: "URL pública; API key opcional para endpoints autenticados.",
    fields: [
      { key: "url", label: "URL", type: "url" },
      { key: "apiKey", label: "API Key", type: "password" },
    ],
  },
  proxmox: {
    title: "Proxmox",
    hint: "Usuario formato user@realm o root@pam.",
    fields: [
      { key: "url", label: "URL", type: "url" },
      { key: "user", label: "Usuario" },
      { key: "password", label: "Contraseña", type: "password" },
      { key: "verifySsl", label: "Verificar certificado SSL", type: "checkbox" },
    ],
  },
  vcenter: {
    title: "VMware vCenter",
    hint: "URL base del appliance (REST).",
    fields: [
      { key: "url", label: "URL", type: "url" },
      { key: "user", label: "Usuario" },
      { key: "password", label: "Contraseña", type: "password" },
    ],
  },
  portainer: {
    title: "Portainer",
    hint: "API Key recomendada; o usuario y contraseña.",
    fields: [
      { key: "url", label: "URL", type: "url" },
      { key: "apiKey", label: "API Key", type: "password" },
      { key: "user", label: "Usuario (si no hay API Key)" },
      { key: "password", label: "Contraseña", type: "password" },
    ],
  },
  nas: {
    title: "NAS (Synology DSM)",
    hint: "Varias URLs separadas por coma si aplica.",
    fields: [
      { key: "url", label: "URL(s)", type: "url" },
      { key: "user", label: "Usuario" },
      { key: "password", label: "Contraseña", type: "password" },
    ],
  },
  qnap: {
    title: "QNAP",
    hint: "URL del NAS (QTS).",
    fields: [
      { key: "url", label: "URL", type: "url" },
      { key: "user", label: "Usuario" },
      { key: "password", label: "Contraseña", type: "password" },
    ],
  },
  hikvision: {
    title: "Hikvision (ISAPI)",
    hint: "NVR/DVR con API HTTP Digest.",
    fields: [
      { key: "url", label: "URL", type: "url" },
      { key: "user", label: "Usuario" },
      { key: "password", label: "Contraseña", type: "password" },
    ],
  },
  m365: {
    title: "Microsoft 365 / Intune",
    hint: "Vista previa: indica el tenant (GUID) para registrar el conector. La integración Microsoft Graph (licencias, Intune, alertas) está en desarrollo.",
    fields: [{ key: "tenantId", label: "Tenant ID (Azure AD)" }],
  },
};

function rowToForm(row: ConnectorRow): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row.payloadMasked ?? {})) {
    if (v === "********") out[k] = "";
    else if (typeof v === "boolean") out[k] = v ? "true" : "false";
    else if (v != null) out[k] = String(v);
  }
  return out;
}

export default function Connectors() {
  const qc = useQueryClient();
  const { data: rows, isLoading } = useQuery({
    queryKey: ["connector-settings"],
    queryFn: () => api.get<ConnectorRow[]>("/connector-settings").then((r) => r.data),
  });

  const [forms, setForms] = useState<Partial<Record<ConnectorType, Record<string, string>>>>({});
  const [enabledMap, setEnabledMap] = useState<Partial<Record<ConnectorType, boolean>>>({});

  useEffect(() => {
    if (!rows) return;
    const nextForms: Partial<Record<ConnectorType, Record<string, string>>> = {};
    const nextEn: Partial<Record<ConnectorType, boolean>> = {};
    for (const r of rows) {
      nextForms[r.type] = rowToForm(r);
      nextEn[r.type] = r.enabled;
    }
    setForms(nextForms);
    setEnabledMap(nextEn);
  }, [rows]);

  const save = useMutation({
    mutationFn: async ({ type, enabled }: { type: ConnectorType; enabled: boolean }) => {
      const raw = forms[type] ?? {};
      const payload: Record<string, unknown> = {};
      const prevMasked = rows?.find((x) => x.type === type)?.payloadMasked ?? {};
      for (const [k, v] of Object.entries(raw)) {
        if (k === "verifySsl") {
          payload[k] = v === "true" || v === "on";
          continue;
        }
        if (v === "") {
          if (SECRET_KEYS.has(k) && prevMasked[k] === "********") continue;
          continue;
        }
        payload[k] = v;
      }
      await api.put(`/connector-settings/${type}`, { enabled, payload });
    },
    onSuccess: () => {
      toast.success("Conector guardado. El backend ya usa la nueva configuración.");
      qc.invalidateQueries({ queryKey: ["connector-settings"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const testConn = useMutation({
    mutationFn: async ({ type, payload }: { type: ConnectorType; payload: Record<string, unknown> }) =>
      api.post(`/connector-settings/${type}/test`, { payload }).then((r) => r.data),
    onSuccess: (data) => {
      if (data?.healthy) toast.success(`Conexión OK (${data.latencyMs ?? "?"} ms)`);
      else toast.error(data?.error ?? "Conexión fallida");
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const [deleteType, setDeleteType] = useState<ConnectorType | null>(null);

  const remove = useMutation({
    mutationFn: (type: ConnectorType) => api.delete(`/connector-settings/${type}`),
    onSuccess: () => {
      toast.success("Configuración en BD eliminada; se usan variables de entorno.");
      setDeleteType(null);
      qc.invalidateQueries({ queryKey: ["connector-settings"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const setField = useCallback((type: ConnectorType, key: string, value: string) => {
    setForms((f) => ({
      ...f,
      [type]: { ...(f[type] ?? {}), [key]: value },
    }));
  }, []);

  const buildTestPayload = (type: ConnectorType): Record<string, unknown> => {
    const raw = forms[type] ?? {};
    const out: Record<string, unknown> = {};
    const prevMasked = rows?.find((x) => x.type === type)?.payloadMasked ?? {};
    for (const [k, v] of Object.entries(raw)) {
      if (k === "verifySsl") {
        out[k] = v === "true" || v === "on";
        continue;
      }
      if (v === "" && SECRET_KEYS.has(k) && prevMasked[k] === "********") continue;
      if (v !== "") out[k] = v;
    }
    return out;
  };

  const orderedTypes = useMemo(() => Object.keys(DEFS) as ConnectorType[], []);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-500 text-sm py-10">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando conectores…
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl animate-fade-in">
      <div>
        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <Plug className="w-5 h-5 text-accent" />
          Conectores
        </h2>
        <p className="text-xs text-slate-500 mt-1 max-w-prose">
          Configura integraciones sin editar <code className="text-[11px] bg-ops-800 px-1 rounded">.env</code>. Los
          secretos se guardan cifrados en base de datos. Si desactivas o borras una fila, se vuelve al valor del
          entorno. Tras guardar, el registro de conectores se reconstruye al vuelo.
        </p>
      </div>

      {orderedTypes.map((type) => {
        const def = DEFS[type];
        const row = rows?.find((r) => r.type === type);
        const enabled = enabledMap[type] ?? row?.enabled ?? false;
        const busy = save.isPending || testConn.isPending || remove.isPending;
        const canDelete =
          !!row && (row.enabled || Object.keys(row.payloadMasked ?? {}).length > 0);

        return (
          <Card key={type}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">{def.title}</CardTitle>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-ops-600 bg-ops-800"
                      checked={enabled}
                      onChange={(e) => setEnabledMap((m) => ({ ...m, [type]: e.target.checked }))}
                    />
                    Activado
                  </label>
                  <Badge className="text-[10px] font-mono">{type}</Badge>
                </div>
              </div>
              <p className="text-xs text-slate-600 mt-1">{def.hint}</p>
            </CardHeader>
            <CardBody className="space-y-4">
              {def.fields.map((field) => {
                const v = forms[type]?.[field.key] ?? "";
                if (field.type === "checkbox") {
                  return (
                    <label key={field.key} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-ops-600 bg-ops-800"
                        checked={v === "true" || v === "on"}
                        onChange={(e) => setField(type, field.key, e.target.checked ? "true" : "false")}
                      />
                      {field.label}
                    </label>
                  );
                }
                return (
                  <Input
                    key={field.key}
                    label={field.label}
                    type={field.type === "password" ? "password" : field.type === "url" ? "url" : "text"}
                    value={v}
                    placeholder={field.type === "password" ? "Dejar vacío para no cambiar" : ""}
                    onChange={(e) => setField(type, field.key, e.target.value)}
                  />
                );
              })}

              <div className="flex flex-wrap gap-2 pt-2 border-t border-ops-700">
                <Button
                  size="sm"
                  variant="outline"
                  icon={<FlaskConical className="w-4 h-4" />}
                  loading={testConn.isPending}
                  disabled={busy}
                  onClick={() => testConn.mutate({ type, payload: buildTestPayload(type) })}
                >
                  Probar conexión
                </Button>
                <Button
                  size="sm"
                  loading={save.isPending}
                  disabled={busy}
                  onClick={() => save.mutate({ type, enabled })}
                >
                  Guardar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Trash2 className="w-4 h-4" />}
                  disabled={busy || !canDelete}
                  onClick={() => setDeleteType(type)}
                >
                  Quitar de BD
                </Button>
              </div>
            </CardBody>
          </Card>
        );
      })}

      <ConfirmDialog
        open={deleteType !== null}
        onClose={() => setDeleteType(null)}
        title="Quitar configuración de conector"
        description={
          deleteType
            ? `Se eliminará la fila en base de datos para «${DEFS[deleteType].title}». Volverás a usar solo variables de entorno si existen.`
            : ""
        }
        danger
        confirmLabel="Eliminar"
        loading={remove.isPending}
        onConfirm={() => {
          if (deleteType) remove.mutate(deleteType);
        }}
      />
    </div>
  );
}
