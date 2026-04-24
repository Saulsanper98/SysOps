import "../config";
import { db, schema } from "./index";
import { logger } from "../utils/logger";

async function run() {
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

  logger.info("✅ Acciones de automatización añadidas.");
  process.exit(0);
}

run().catch((err) => { logger.error(err); process.exit(1); });
