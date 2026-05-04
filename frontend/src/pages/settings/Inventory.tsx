import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Database, Wrench } from "lucide-react";
import { api, apiError } from "../../lib/api";
import { Card, CardBody, CardHeader, CardTitle } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { useAuthStore } from "../../store/useStore";
import { formatDate } from "../../lib/utils";
import toast from "react-hot-toast";

export interface CmdbSystemRow {
  id: string;
  name: string;
  type: string;
  category: string | null;
  environment: string | null;
  connectorType: string | null;
  connectorId: string | null;
  maintenanceUntil: string | null;
  maintenanceReason: string | null;
  active: boolean;
  tags: string[] | null;
  updatedAt: string;
}

function toLocalDatetimeInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Inventory() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const canEdit = user?.role === "admin" || user?.role === "tecnico";
  const [search, setSearch] = useState("");
  const [editRow, setEditRow] = useState<CmdbSystemRow | null>(null);
  const [maintUntil, setMaintUntil] = useState("");
  const [maintReason, setMaintReason] = useState("");

  const { data: rows, isLoading } = useQuery<CmdbSystemRow[]>({
    queryKey: ["cmdb-systems"],
    queryFn: () => api.get("/cmdb/systems").then((r) => r.data),
  });

  const filtered = useMemo(() => {
    const list = rows ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.environment?.toLowerCase().includes(q) ?? false) ||
        (r.connectorType?.toLowerCase().includes(q) ?? false) ||
        (r.tags ?? []).some((t) => t.toLowerCase().includes(q)),
    );
  }, [rows, search]);

  const openEdit = (r: CmdbSystemRow) => {
    setEditRow(r);
    setMaintUntil(toLocalDatetimeInput(r.maintenanceUntil));
    setMaintReason(r.maintenanceReason ?? "");
  };

  const saveMaint = useMutation({
    mutationFn: async (body: { maintenanceUntil: string | null; maintenanceReason: string | null }) => {
      if (!editRow) return;
      await api.patch(`/cmdb/systems/${editRow.id}/maintenance`, body);
    },
    onSuccess: () => {
      toast.success("Mantenimiento actualizado");
      qc.invalidateQueries({ queryKey: ["cmdb-systems"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      qc.invalidateQueries({ queryKey: ["dashboard-systems"] });
      setEditRow(null);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const clearMaint = () => {
    if (!editRow) return;
    saveMaint.mutate({ maintenanceUntil: null, maintenanceReason: null });
  };

  const submitMaint = () => {
    const untilIso =
      maintUntil.trim() === "" ? null : new Date(maintUntil).toISOString();
    saveMaint.mutate({
      maintenanceUntil: untilIso,
      maintenanceReason: maintReason.trim() || null,
    });
  };

  return (
    <div className="max-w-6xl space-y-5 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 flex items-center justify-center">
            <Database className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100">Inventario CMDB</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Sistemas gobernados en base de datos (entorno, tags, mantenimiento). La vista{" "}
              <Link to="/systems" className="text-accent hover:underline">
                Sistemas
              </Link>{" "}
              refleja el estado en vivo de los conectores.
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registros</CardTitle>
          <span className="text-xs text-slate-500">{filtered.length} filas</span>
        </CardHeader>
        <CardBody className="space-y-3">
          <Input
            placeholder="Buscar por nombre, entorno, conector o tag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {isLoading ? (
            <p className="text-sm text-slate-600 py-8 text-center">Cargando…</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-ops-600">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ops-600 bg-ops-850/80 text-left text-xs text-slate-500 uppercase tracking-wide">
                    <th className="px-3 py-2">Nombre</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Entorno</th>
                    <th className="px-3 py-2">Conector</th>
                    <th className="px-3 py-2">Mantenimiento</th>
                    <th className="px-3 py-2">Tags</th>
                    {canEdit && <th className="px-3 py-2 w-28" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ops-700/60">
                  {filtered.map((r) => {
                    const inMaint = r.maintenanceUntil && new Date(r.maintenanceUntil) > new Date();
                    return (
                      <tr key={r.id} className="hover:bg-ops-800/50">
                        <td className="px-3 py-2 font-medium text-slate-200">{r.name}</td>
                        <td className="px-3 py-2 text-slate-400 capitalize">{r.type}</td>
                        <td className="px-3 py-2 text-slate-500">{r.environment ?? "—"}</td>
                        <td className="px-3 py-2 text-slate-500 font-mono text-xs">
                          {r.connectorType ?? "—"}
                        </td>
                        <td className="px-3 py-2">
                          {inMaint ? (
                            <Badge className="text-[10px] border-amber-500/40 text-amber-300 bg-amber-500/10">
                              hasta {formatDate(r.maintenanceUntil!)}
                            </Badge>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {(r.tags ?? []).slice(0, 4).map((t) => (
                              <span
                                key={t}
                                className="px-1.5 py-0.5 rounded text-[10px] bg-ops-700 text-slate-400 border border-ops-600"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </td>
                        {canEdit && (
                          <td className="px-3 py-2">
                            <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                              <Wrench className="w-3.5 h-3.5 mr-1" />
                              Silencio
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {editRow && canEdit && (
        <Dialog open={true} title={`Mantenimiento: ${editRow.name}`} onClose={() => setEditRow(null)} size="md">
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Mientras la fecha sea futura, las alertas de este sistema CMDB se suprimen en el registro de
              conectores (menos ruido en cortes planificados).
            </p>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Fin de ventana (hora local)</label>
              <input
                type="datetime-local"
                value={maintUntil}
                onChange={(e) => setMaintUntil(e.target.value)}
                className="w-full bg-ops-850 border border-ops-600 rounded-lg px-3 py-2 text-sm text-slate-200"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Motivo (opcional)</label>
              <textarea
                value={maintReason}
                onChange={(e) => setMaintReason(e.target.value)}
                rows={3}
                className="w-full bg-ops-850 border border-ops-600 rounded-lg px-3 py-2 text-sm text-slate-200 resize-y"
                placeholder="Ej. Actualización de firmware SAN"
              />
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="ghost" onClick={clearMaint} disabled={saveMaint.isPending}>
                Quitar mantenimiento
              </Button>
              <Button onClick={submitMaint} loading={saveMaint.isPending}>
                Guardar
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
