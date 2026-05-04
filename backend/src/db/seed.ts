import "../config"; // carga dotenv antes de cualquier cosa
import { db, schema } from "./index";
import { eq } from "drizzle-orm";
import { hashPassword } from "../auth";
import { logger } from "../utils/logger";

async function seed() {
  logger.info("Seeding database...");

  // Users
  const adminHash = await hashPassword("Admin1234!");
  const techHash = await hashPassword("Tech1234!");

  await db
    .insert(schema.users)
    .values([
      {
        username: "admin",
        email: "admin@empresa.local",
        displayName: "Administrador",
        passwordHash: adminHash,
        role: "admin",
      },
      {
        username: "jgarcia",
        email: "jgarcia@empresa.local",
        displayName: "Juan García",
        passwordHash: techHash,
        role: "tecnico",
      },
      {
        username: "mlopez",
        email: "mlopez@empresa.local",
        displayName: "María López",
        passwordHash: techHash,
        role: "tecnico",
      },
      {
        username: "rperez",
        email: "rperez@empresa.local",
        displayName: "Roberto Pérez",
        passwordHash: techHash,
        role: "tecnico",
      },
    ])
    .onConflictDoNothing();

  // Systems
  const [adminUser] = await db.select().from(schema.users).limit(1);

  await db
    .insert(schema.systems)
    .values([
      { name: "PROD-DB-01", type: "server", category: "compute", environment: "produccion", tags: ["db", "prod"], connectorType: "zabbix" },
      { name: "PROD-DB-02", type: "server", category: "compute", environment: "produccion", tags: ["db", "prod"], connectorType: "zabbix" },
      { name: "APP-SRV-01", type: "server", category: "compute", environment: "produccion", tags: ["app", "prod"], connectorType: "zabbix" },
      { name: "APP-SRV-02", type: "server", category: "compute", environment: "produccion", tags: ["app", "prod"], connectorType: "zabbix" },
      { name: "WEB-01", type: "server", category: "compute", environment: "produccion", tags: ["web", "nginx"], connectorType: "zabbix" },
      { name: "NAS-01", type: "storage", category: "storage", environment: "produccion", tags: ["nas", "almacenamiento"], connectorType: "nas" },
      { name: "Portal Intranet", type: "service", category: "application", environment: "produccion", tags: ["web", "intranet"], connectorType: "uptime_kuma" },
    ])
    .onConflictDoNothing();

  // Automation Actions
  await db
    .insert(schema.automationActions)
    .values([
      {
        name: "Health Check HTTP",
        description: "Verifica que un endpoint HTTP responde correctamente",
        category: "health-check",
        icon: "Activity",
        targetType: "service",
        jobName: "health-check-http",
        parameters: [{ name: "url", type: "string", label: "URL", required: true, placeholder: "https://servicio.local" }],
        requiredRole: "tecnico",
        dangerous: false,
      },
      {
        name: "Ping / Conectividad",
        description: "Verifica conectividad ICMP con un host",
        category: "health-check",
        icon: "Wifi",
        targetType: "system",
        jobName: "health-check-ping",
        parameters: [{ name: "host", type: "string", label: "Host / IP", required: true, placeholder: "192.168.1.1" }],
        requiredRole: "tecnico",
        dangerous: false,
      },
      {
        name: "Limpiar Logs de Disco",
        description: "Elimina archivos de log con más de 30 días en el directorio especificado",
        category: "cleanup",
        icon: "Trash2",
        targetType: "system",
        jobName: "disk-cleanup-logs",
        parameters: [{ name: "path", type: "string", label: "Ruta", required: false, default: "/var/log" }],
        requiredRole: "tecnico",
        dangerous: false,
      },
      {
        name: "Reiniciar Servicio",
        description: "Reinicia un servicio en un host remoto vía SSH",
        category: "restart",
        icon: "RefreshCw",
        targetType: "system",
        jobName: "service-restart",
        parameters: [
          { name: "host", type: "string", label: "Host", required: true },
          { name: "service", type: "string", label: "Nombre del servicio", required: true, placeholder: "nginx" },
        ],
        requiredRole: "tecnico",
        dangerous: true,
      },
      {
        name: "Crear Snapshot VM",
        description: "Crea un snapshot de una VM antes de aplicar cambios",
        category: "snapshot",
        icon: "Camera",
        targetType: "vm",
        connectorType: "proxmox",
        jobName: "vm-snapshot",
        parameters: [{ name: "vm", type: "string", label: "Nombre de VM", required: true }],
        requiredRole: "tecnico",
        dangerous: false,
      },
      {
        name: "Verificar Certificados SSL",
        description: "Comprueba la caducidad de certificados SSL en los dominios especificados",
        category: "validate",
        icon: "Shield",
        targetType: "service",
        jobName: "cert-check",
        parameters: [{ name: "domains", type: "string", label: "Dominios (separados por coma)", required: true }],
        requiredRole: "tecnico",
        dangerous: false,
      },
      {
        name: "Health Check Completo",
        description: "Ejecuta un health check de todos los conectores configurados",
        category: "health-check",
        icon: "CheckCircle",
        targetType: "all",
        jobName: "full-health-check",
        parameters: [],
        requiredRole: "tecnico",
        dangerous: false,
      },
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

  // Demo incidents
  const [jgarcia, mlopez] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.active, true))
    .limit(4)
    .then((u) => u.filter((x) => x.username !== "admin"));

  const [webSrv] = await db
    .select()
    .from(schema.systems)
    .where(eq(schema.systems.active, true))
    .limit(1);

  if (jgarcia && webSrv) {
    await db
      .insert(schema.incidents)
      .values([
        {
          title: "Servicio nginx caído en WEB-01",
          description: "El servicio nginx dejó de responder en el servidor WEB-01. Los usuarios no pueden acceder al portal.",
          severity: "critica",
          status: "en_progreso",
          systemId: webSrv.id,
          assignedTo: jgarcia.id,
          createdBy: adminUser.id,
          tags: ["nginx", "web", "prod"],
          impact: "Todos los usuarios sin acceso al portal intranet",
        },
        {
          title: "Disco /var/log lleno al 95% en APP-SRV-02",
          description: "El disco de logs está casi lleno. Riesgo de caída de servicios si se llena al 100%.",
          severity: "critica",
          status: "abierta",
          createdBy: adminUser.id,
          tags: ["disco", "logs", "prod"],
          impact: "Posible caída de aplicaciones si el disco llega al 100%",
        },
        {
          title: "CPU alta en PROD-DB-01 (92%)",
          description: "La CPU del servidor de base de datos principal lleva más de 30 minutos por encima del 90%.",
          severity: "alta",
          status: "en_progreso",
          assignedTo: mlopez?.id ?? jgarcia.id,
          createdBy: adminUser.id,
          tags: ["cpu", "db", "rendimiento"],
        },
        {
          title: "Caída de portal intranet — Error 502",
          description: "El portal de intranet devuelve 502 Bad Gateway.",
          severity: "alta",
          status: "resuelta",
          createdBy: adminUser.id,
          rootCause: "El proceso PHP-FPM se quedó sin workers disponibles por una query sin índice.",
          resolution: "Se reinició PHP-FPM y se añadió índice faltante en tabla `sessions`.",
          resolvedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          tags: ["intranet", "502", "php"],
        },
      ])
      .onConflictDoNothing();
  }

  // KB articles
  await db
    .insert(schema.kbArticles)
    .values([
      {
        title: "Cómo limpiar logs de nginx en producción",
        content: `## Problema\nEl disco de logs en servidores web puede llenarse rápidamente.\n\n## Solución\n\`\`\`bash\n# Ver tamaño actual\ndu -sh /var/log/nginx/\n\n# Rotar y limpiar\nnginx -s reopen\nfind /var/log/nginx/ -name "*.log.*" -mtime +7 -delete\n\`\`\`\n\n## Prevención\nConfigurar logrotate correctamente.`,
        summary: "Guía para limpiar y gestionar logs de nginx en producción sin cortar el servicio.",
        tags: ["nginx", "logs", "disco", "linux"],
        autoGenerated: false,
        published: true,
        version: 1,
        createdBy: adminUser.id,
        updatedBy: adminUser.id,
      },
      {
        title: "Troubleshooting: Error 502 Bad Gateway en PHP-FPM",
        content: `## Causa habitual\nPHP-FPM se queda sin workers cuando hay muchas peticiones lentas.\n\n## Diagnóstico\n\`\`\`bash\nphp-fpm -t  # test config\ntail -f /var/log/php-fpm/error.log\nss -tulpn | grep php\n\`\`\`\n\n## Solución rápida\n\`\`\`bash\nsystemctl restart php8.2-fpm\n\`\`\`\n\n## Solución permanente\nOptimizar queries lentas y ajustar pm.max_children en php-fpm.conf.`,
        summary: "PHP-FPM sin workers — cómo diagnosticar y resolver el error 502.",
        tags: ["php-fpm", "502", "nginx", "web"],
        autoGenerated: false,
        published: true,
        version: 1,
        createdBy: adminUser.id,
        updatedBy: adminUser.id,
      },
      {
        title: "Recuperación de RAID degradado en NAS Synology",
        content: `## Diagnóstico\nAcceder a Synology DSM > Administrador de almacenamiento > RAID.\n\n## Pasos\n1. Identificar el disco con errores (LED ámbar)\n2. Verificar con: \`cat /proc/mdstat\`\n3. Reemplazar disco defectuoso\n4. Iniciar reconstrucción desde DSM\n5. Monitorizar progreso (~2h por TB)\n\n## Tiempo estimado\n4-8 horas para RAID5 con 4TB por disco.\n\n## Prevención\nAlertas configuradas en Zabbix para fallos de disco S.M.A.R.T.`,
        summary: "Procedimiento para recuperar un RAID degradado en NAS Synology.",
        tags: ["nas", "raid", "synology", "almacenamiento"],
        autoGenerated: false,
        published: true,
        version: 1,
        createdBy: adminUser.id,
        updatedBy: adminUser.id,
      },
    ])
    .onConflictDoNothing();

  logger.info("✅ Seed completado.");
  process.exit(0);
}

seed().catch((err) => {
  logger.error(err, "Seed failed");
  process.exit(1);
});
