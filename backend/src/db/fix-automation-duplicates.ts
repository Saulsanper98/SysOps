import "../config";
import { db, schema } from "./index";
import { sql } from "drizzle-orm";
import { logger } from "../utils/logger";

async function fix() {
  logger.info("Corrigiendo duplicados de automation_actions...");

  // 1. Reasignar automation_runs que apunten a duplicados → apuntar al original (el más antiguo)
  await db.execute(sql`
    UPDATE automation_runs ar
    SET action_id = (
      SELECT id FROM automation_actions
      WHERE job_name = (SELECT job_name FROM automation_actions WHERE id = ar.action_id)
      ORDER BY created_at ASC
      LIMIT 1
    )
    WHERE action_id IN (
      SELECT id FROM automation_actions
      WHERE id NOT IN (
        SELECT DISTINCT ON (job_name) id
        FROM automation_actions
        ORDER BY job_name, created_at ASC
      )
    )
  `);

  // 2. Ahora sí borrar los duplicados (ya sin referencias)
  await db.execute(sql`
    DELETE FROM automation_actions
    WHERE id NOT IN (
      SELECT DISTINCT ON (job_name) id
      FROM automation_actions
      ORDER BY job_name, created_at ASC
    )
  `);

  // 3. Añadir constraint única en job_name
  await db.execute(sql`
    ALTER TABLE automation_actions
    DROP CONSTRAINT IF EXISTS automation_actions_job_name_unique
  `);
  await db.execute(sql`
    ALTER TABLE automation_actions
    ADD CONSTRAINT automation_actions_job_name_unique UNIQUE (job_name)
  `);

  // 4. Insertar las nuevas acciones si no existen
  await db
    .insert(schema.automationActions)
    .values([
      {
        name: "Resumen de Alertas Activas",
        description: "Obtiene un resumen de todas las alertas activas de todos los conectores",
        category: "health-check",
        icon: "Bell",
        targetType: "all",
        jobName: "alerts-summary",
        parameters: [],
        requiredRole: "tecnico",
        dangerous: false,
      },
      {
        name: "Estado de Sistemas",
        description: "Genera un informe del estado de todos los sistemas monitorizados",
        category: "validate",
        icon: "BarChart2",
        targetType: "all",
        jobName: "systems-status",
        parameters: [],
        requiredRole: "tecnico",
        dangerous: false,
      },
    ])
    .onConflictDoNothing();

  const result = await db.execute(sql`SELECT COUNT(*) as total FROM automation_actions`);
  logger.info(`✅ Listo. Acciones únicas en BD: ${result.rows[0].total}`);
  process.exit(0);
}

fix().catch((err) => { logger.error(err); process.exit(1); });
