import type { Incident } from "../types";

function cell(v: string) {
  const s = v.replace(/\r?\n/g, " ").replace(/"/g, '""');
  return `"${s}"`;
}

/** Genera CSV UTF-8 con BOM para Excel a partir de las filas visibles. */
export function incidentsToCsv(rows: Incident[]): string {
  const header = ["id", "titulo", "severidad", "estado", "creado", "sistema", "asignado", "tags"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        cell(r.title),
        r.severity,
        r.status,
        r.createdAt,
        cell(r.system?.name ?? ""),
        cell(r.assignedUser?.displayName ?? ""),
        cell((r.tags ?? []).join("; ")),
      ].join(","),
    );
  }
  return `\ufeff${lines.join("\n")}`;
}

export function downloadIncidentsCsv(rows: Incident[], filename = "incidencias.csv") {
  const blob = new Blob([incidentsToCsv(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
