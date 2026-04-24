import { z } from "zod";
import dotenv from "dotenv";
import path from "path";

// Carga .env desde la raíz del proyecto (un nivel arriba de /backend)
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3001),
  FRONTEND_URL: z.string().default("http://localhost:5173"),

  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 chars"),
  JWT_EXPIRES_IN: z.string().default("8h"),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().default("redis://localhost:6379"),

  DEMO_MODE: z
    .string()
    .transform((v) => v === "true" || v === "1")
    .default("true"),

  // Connectors
  ZABBIX_URL: z.string().optional(),
  ZABBIX_USER: z.string().optional(),
  ZABBIX_PASSWORD: z.string().optional(),

  UPTIME_KUMA_URL: z.string().optional(),
  UPTIME_KUMA_API_KEY: z.string().optional(),

  PROXMOX_URL: z.string().optional(),
  PROXMOX_USER: z.string().optional(),
  PROXMOX_PASSWORD: z.string().optional(),
  PROXMOX_VERIFY_SSL: z
    .string()
    .transform((v) => v === "true" || v === "1")
    .default("false"),

  VCENTER_URL: z.string().optional(),
  VCENTER_USER: z.string().optional(),
  VCENTER_PASSWORD: z.string().optional(),

  PORTAINER_URL: z.string().optional(),
  PORTAINER_API_KEY: z.string().optional(),
  PORTAINER_USER: z.string().optional(),
  PORTAINER_PASSWORD: z.string().optional(),

  NAS_URL: z.string().optional(),
  NAS_USER: z.string().optional(),
  NAS_PASSWORD: z.string().optional(),

  // Notifications
  TEAMS_WEBHOOK_URL: z.string().optional(),

  // QNAP NAS
  QNAP_URL: z.string().optional(),
  QNAP_USER: z.string().optional(),
  QNAP_PASSWORD: z.string().optional(),

  // Hikvision NVR/DVR (ISAPI)
  HIKVISION_URL: z.string().optional(),
  HIKVISION_USER: z.string().optional(),
  HIKVISION_PASSWORD: z.string().optional(),

  // Encryption
  ENCRYPTION_KEY: z.string().default("sysops-hub-default-key-32-chars!!"),

  // Backup
  BACKUP_PATH: z.string().default("/tmp"),

  // Entra ID (optional SSO)
  ENTRA_CLIENT_ID: z.string().optional(),
  ENTRA_CLIENT_SECRET: z.string().optional(),
  ENTRA_TENANT_ID: z.string().optional(),
  ENTRA_REDIRECT_URI: z.string().optional(),
  ENTRA_DEFAULT_ROLE: z.enum(["admin", "tecnico", "readonly"]).default("readonly"),

  // TOTP
  TOTP_ISSUER: z.string().default("SysOps Hub"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;
