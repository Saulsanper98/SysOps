import { db, schema } from "../db";
import { and, gt, isNotNull } from "drizzle-orm";

/** Nombres de sistemas CMDB en mantenimiento activo (comparar en minúsculas con alert.systemName). */
export async function getMaintenanceSystemNamesLower(): Promise<Set<string>> {
  const now = new Date();
  const rows = await db
    .select({ name: schema.systems.name })
    .from(schema.systems)
    .where(and(isNotNull(schema.systems.maintenanceUntil), gt(schema.systems.maintenanceUntil, now)));
  return new Set(rows.map((r) => r.name.toLowerCase()));
}
