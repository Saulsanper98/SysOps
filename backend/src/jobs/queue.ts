import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { config } from "../config";
import { logger } from "../utils/logger";
import { db, schema } from "../db";
import { eq } from "drizzle-orm";

const connection = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });

export const automationQueue = new Queue("automations", { connection });
export const alertSyncQueue = new Queue("alert-sync", { connection });

export interface AutomationJobData {
  runId: string;
  actionId: string;
  jobName: string;
  parameters: Record<string, unknown>;
  triggeredBy: string;
  systemId?: string;
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export async function startWorker() {
  const worker = new Worker<AutomationJobData>(
    "automations",
    async (job) => {
      const { runId, jobName, parameters } = job.data;
      logger.info({ runId, jobName }, "Automation job started");

      await db
        .update(schema.automationRuns)
        .set({ status: "ejecutando", startedAt: new Date(), jobId: job.id })
        .where(eq(schema.automationRuns.id, runId));

      try {
        const output = await executeJob(jobName, parameters, job);

        await db
          .update(schema.automationRuns)
          .set({ status: "completada", output, finishedAt: new Date() })
          .where(eq(schema.automationRuns.id, runId));

        logger.info({ runId, jobName }, "Automation job completed");
        return output;
      } catch (err: any) {
        await db
          .update(schema.automationRuns)
          .set({ status: "fallida", error: err.message, finishedAt: new Date() })
          .where(eq(schema.automationRuns.id, runId));

        logger.error({ runId, jobName, err: err.message }, "Automation job failed");
        throw err;
      }
    },
    { connection, concurrency: 5 },
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, "BullMQ job failed");
  });

  logger.info("Automation worker started");
  return worker;
}

// ─── Job Implementations ──────────────────────────────────────────────────────

async function executeJob(
  jobName: string,
  parameters: Record<string, unknown>,
  job: Job,
): Promise<string> {
  const lines: string[] = [];
  const log = (msg: string) => {
    lines.push(`[${new Date().toISOString()}] ${msg}`);
    job.log(msg);
  };

  switch (jobName) {

    // ── HTTP Health Check ──────────────────────────────────────────────────────
    case "health-check-http": {
      const url = parameters.url as string;
      if (!url) throw new Error("Parámetro 'url' requerido");
      log(`🌐 Iniciando health check HTTP: ${url}`);
      const axios = (await import("axios")).default;
      const start = Date.now();
      try {
        const resp = await axios.get(url, {
          timeout: 10000,
          validateStatus: () => true,
          maxRedirects: 5,
        });
        const ms = Date.now() - start;
        const icon = resp.status < 400 ? "✅" : resp.status < 500 ? "⚠️ " : "❌";
        log(`${icon} Respuesta: HTTP ${resp.status} en ${ms}ms`);
        if (resp.status >= 500) throw new Error(`HTTP ${resp.status} — servicio con error`);
        if (resp.status >= 400) log(`⚠️  Advertencia: código ${resp.status} — revisar servicio`);
        else log(`Servicio operativo.`);
      } catch (err: any) {
        if (err.code === "ECONNREFUSED") throw new Error(`Conexión rechazada — servicio caído o puerto incorrecto`);
        if (err.code === "ETIMEDOUT") throw new Error(`Timeout — servicio no responde en 10s`);
        throw err;
      }
      return lines.join("\n");
    }

    // ── Ping / Conectividad ────────────────────────────────────────────────────
    case "health-check-ping": {
      const host = parameters.host as string;
      if (!host) throw new Error("Parámetro 'host' requerido");
      log(`📡 Verificando conectividad con ${host}...`);
      const { execSync } = await import("child_process");
      const isWindows = process.platform === "win32";
      // Windows: ping -n 4   |   Linux/Mac: ping -c 4
      const cmd = isWindows ? `ping -n 4 ${host}` : `ping -c 4 ${host}`;
      try {
        const out = execSync(cmd, { timeout: 15000 }).toString();
        log(out.trim());
        // Extract avg latency
        const avgMatch = isWindows
          ? out.match(/Media\s*=\s*(\d+)ms/i) || out.match(/Average\s*=\s*(\d+)ms/i)
          : out.match(/rtt.*=\s*[\d.]+\/([\d.]+)/);
        if (avgMatch) log(`✅ Host alcanzable — latencia media: ${avgMatch[1]}ms`);
        else log(`✅ Host alcanzable`);
        return lines.join("\n");
      } catch {
        throw new Error(`❌ No se puede alcanzar ${host} — host inaccesible o ICMP bloqueado`);
      }
    }

    // ── Verificar Certificados SSL ─────────────────────────────────────────────
    case "cert-check": {
      const domainsRaw = parameters.domains as string;
      if (!domainsRaw) throw new Error("Parámetro 'domains' requerido");
      const domains = domainsRaw.split(",").map((d) => d.trim()).filter(Boolean);
      log(`🔒 Verificando certificados SSL para ${domains.length} dominio(s)...`);
      log("");
      const tls = await import("tls");
      const net = await import("net");

      for (const rawDomain of domains) {
        const [hostname, portStr] = rawDomain.replace(/https?:\/\//, "").split(":");
        const port = parseInt(portStr ?? "443");
        try {
          const daysLeft = await checkCertExpiry(tls, net, hostname, port);
          const icon = daysLeft < 7 ? "🔴" : daysLeft < 30 ? "🟡" : "🟢";
          const status = daysLeft < 7 ? "CRÍTICO" : daysLeft < 30 ? "PRONTO A EXPIRAR" : "OK";
          log(`${icon} ${hostname}:${port} — ${status} — ${daysLeft} días restantes`);
        } catch (err: any) {
          log(`❌ ${hostname}:${port} — Error: ${err.message}`);
        }
        await delay(300);
      }
      log("");
      log("✅ Verificación completada.");
      return lines.join("\n");
    }

    // ── Health Check Completo ──────────────────────────────────────────────────
    case "full-health-check": {
      log("═══════════════════════════════");
      log("    HEALTH CHECK COMPLETO");
      log("═══════════════════════════════");
      log("");
      const connectors = (await import("../connectors/registry")).registry;
      const results = await connectors.checkAll();
      let healthy = 0;
      for (const r of results) {
        const icon = r.healthy ? "✅" : "❌";
        const latency = r.latencyMs ? ` (${r.latencyMs}ms)` : "";
        const error = r.error ? ` — ${r.error}` : "";
        log(`${icon} ${r.displayName}${latency}${error}`);
        if (r.healthy) healthy++;
      }
      log("");
      log(`Resultado: ${healthy}/${results.length} conectores operativos`);
      if (healthy < results.length) {
        throw new Error(`${results.length - healthy} conector(es) con fallo`);
      }
      return lines.join("\n");
    }

    // ── Resumen de Alertas Activas ─────────────────────────────────────────────
    case "alerts-summary": {
      log("═══════════════════════════════");
      log("   RESUMEN DE ALERTAS ACTIVAS");
      log("═══════════════════════════════");
      log("");
      const registry = (await import("../connectors/registry")).registry;
      const alerts = await registry.getAllAlerts();
      if (!alerts.length) {
        log("✅ Sin alertas activas en este momento.");
        return lines.join("\n");
      }
      const bySeverity = { critica: 0, alta: 0, media: 0, baja: 0, info: 0 };
      for (const a of alerts) bySeverity[a.severity] = (bySeverity[a.severity] ?? 0) + 1;

      log(`Total: ${alerts.length} alerta(s) activa(s)`);
      log("");
      if (bySeverity.critica) log(`🔴 Críticas:  ${bySeverity.critica}`);
      if (bySeverity.alta)    log(`🟠 Altas:     ${bySeverity.alta}`);
      if (bySeverity.media)   log(`🟡 Medias:    ${bySeverity.media}`);
      if (bySeverity.baja)    log(`🔵 Bajas:     ${bySeverity.baja}`);
      if (bySeverity.info)    log(`⚪ Info:      ${bySeverity.info}`);
      log("");
      log("── TOP 10 ALERTAS ──────────────");
      const top = alerts
        .sort((a, b) => {
          const order = { critica: 0, alta: 1, media: 2, baja: 3, info: 4 };
          return (order[a.severity] ?? 5) - (order[b.severity] ?? 5);
        })
        .slice(0, 10);
      for (const a of top) {
        const icons = { critica: "🔴", alta: "🟠", media: "🟡", baja: "🔵", info: "⚪" };
        log(`${icons[a.severity] ?? "•"} [${a.systemName}] ${a.title}`);
      }
      return lines.join("\n");
    }

    // ── Estado de Sistemas ─────────────────────────────────────────────────────
    case "systems-status": {
      log("═══════════════════════════════");
      log("     ESTADO DE SISTEMAS");
      log("═══════════════════════════════");
      log("");
      const registry = (await import("../connectors/registry")).registry;
      const systems = await registry.getAllSystems();
      if (!systems.length) {
        log("Sin sistemas registrados.");
        return lines.join("\n");
      }
      const byStatus = { ok: 0, degradado: 0, critico: 0, desconocido: 0 };
      for (const s of systems) byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;

      log(`Total sistemas: ${systems.length}`);
      log(`✅ OK:          ${byStatus.ok}`);
      log(`⚠️  Degradados:  ${byStatus.degradado}`);
      log(`🔴 Críticos:    ${byStatus.critico}`);
      log(`❓ Desconocido: ${byStatus.desconocido}`);

      const problems = systems.filter((s) => s.status === "critico" || s.status === "degradado");
      if (problems.length) {
        log("");
        log("── SISTEMAS CON PROBLEMAS ──────");
        for (const s of problems) {
          const icon = s.status === "critico" ? "🔴" : "⚠️ ";
          log(`${icon} ${s.name} (${s.type}) — ${s.status}`);
        }
      }
      return lines.join("\n");
    }

    // ── Limpiar Logs de Disco (simulado — requeriría SSH real) ────────────────
    case "disk-cleanup-logs": {
      const logPath = (parameters.path as string) ?? "/var/log";
      log(`🗑️  Análisis de logs en ${logPath}...`);
      await delay(1500);
      log(`Nota: Esta acción requiere acceso SSH al servidor objetivo.`);
      log(`Para automatización real, configura las claves SSH en el servidor.`);
      log("");
      log(`Comando que se ejecutaría:`);
      log(`  find ${logPath} -name "*.log.*" -mtime +30 -exec ls -lh {} \\;`);
      log(`  find ${logPath} -name "*.log.*" -mtime +30 -delete`);
      log("");
      log(`⚠️  Ejecución simulada — no se eliminaron archivos reales.`);
      return lines.join("\n");
    }

    // ── Reiniciar Servicio (simulado — requeriría SSH real) ───────────────────
    case "service-restart": {
      const service = parameters.service as string;
      const host = parameters.host as string;
      if (!service || !host) throw new Error("Parámetros 'host' y 'service' requeridos");
      log(`🔄 Solicitud de reinicio: ${service} en ${host}`);
      log(`Nota: Esta acción requiere acceso SSH al servidor objetivo.`);
      log("");
      log(`Comando que se ejecutaría:`);
      log(`  ssh admin@${host} "sudo systemctl restart ${service}"`);
      log(`  ssh admin@${host} "sudo systemctl status ${service}"`);
      log("");
      log(`⚠️  Ejecución simulada — configura SSH para habilitar reinicio real.`);
      return lines.join("\n");
    }

    // ── Crear Snapshot VM (simulado — requeriría Proxmox/vCenter) ────────────
    case "vm-snapshot": {
      const vmName = parameters.vm as string;
      if (!vmName) throw new Error("Parámetro 'vm' requerido");
      const snapName = `sysops-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}`;
      log(`📸 Solicitud de snapshot para VM: ${vmName}`);
      log(`Nombre del snapshot: ${snapName}`);
      log("");
      log(`Nota: Esta acción requiere Proxmox o vCenter configurado.`);
      log(`Configura PROXMOX_URL en el .env para habilitar snapshots reales.`);
      log("");
      log(`⚠️  Ejecución simulada — snapshot no creado en infraestructura real.`);
      return lines.join("\n");
    }

    // ── SSH Command Execution ──────────────────────────────────────────────────
    case "ssh-exec": {
      const { credentialId, command } = parameters;
      if (!credentialId || !command) throw new Error("Parámetros 'credentialId' y 'command' requeridos");
      log(`🔐 Conectando vía SSH...`);
      const { executeSSHCommand } = await import("../services/sshService");
      await executeSSHCommand(credentialId as string, command as string, (chunk) => log(chunk));
      return lines.join("\n");
    }

    // ── PostgreSQL Backup ──────────────────────────────────────────────────────
    case "db-backup": {
      log("💾 Iniciando backup de base de datos...");
      const { execSync } = await import("child_process");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const backupFile = `sysops-backup-${timestamp}.sql`;
      const backupPath = process.env.BACKUP_PATH ?? "/tmp";
      log(`Destino: ${backupPath}/${backupFile}`);
      execSync(`pg_dump "${process.env.DATABASE_URL}" -f "${backupPath}/${backupFile}"`, { timeout: 120000 });
      log(`✅ Backup completado: ${backupFile}`);
      return lines.join("\n");
    }

    default:
      log(`⚙️  Ejecutando job: ${jobName}`);
      await delay(1000);
      log(`✅ Completado`);
      return lines.join("\n");
  }
}

// ─── SSL cert expiry check via raw TLS ────────────────────────────────────────

function checkCertExpiry(tls: any, net: any, hostname: string, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      { host: hostname, port, servername: hostname, rejectUnauthorized: false },
      () => {
        const cert = socket.getPeerCertificate();
        socket.destroy();
        if (!cert?.valid_to) return reject(new Error("No se pudo obtener certificado"));
        const expiry = new Date(cert.valid_to);
        const daysLeft = Math.floor((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        resolve(daysLeft);
      },
    );
    socket.setTimeout(8000, () => { socket.destroy(); reject(new Error("Timeout de conexión TLS")); });
    socket.on("error", reject);
  });
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
