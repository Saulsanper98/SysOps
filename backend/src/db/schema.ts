import {
  pgTable, text, timestamp, boolean, integer, jsonb,
  uuid, pgEnum, index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

const emptyArray = sql`ARRAY[]::text[]`;

// ─── Enums ────────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", ["admin", "tecnico", "readonly"]);

export const severityEnum = pgEnum("severity", ["critica", "alta", "media", "baja", "info"]);

export const incidentStatusEnum = pgEnum("incident_status", [
  "abierta", "en_progreso", "pendiente", "resuelta", "cerrada",
]);

export const automationStatusEnum = pgEnum("automation_status", [
  "pendiente", "ejecutando", "completada", "fallida", "cancelada",
]);

export const connectorTypeEnum = pgEnum("connector_type", [
  "zabbix", "uptime_kuma", "proxmox", "vcenter", "portainer", "nas", "m365", "qnap", "hikvision",
]);

export const notificationTypeEnum = pgEnum("notification_type", ["info", "warning", "error", "success"]);
export const metricTypeEnum = pgEnum("metric_type", ["alerts_count", "systems_ok", "latency_ms", "incidents_open"]);

export const auditActionEnum = pgEnum("audit_action", [
  "create", "update", "delete", "execute", "login", "logout", "assign",
  "resolve", "close", "escalate",
]);

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash"),
  role: userRoleEnum("role").notNull().default("tecnico"),
  active: boolean("active").notNull().default(true),
  avatar: text("avatar"),
  entraId: text("entra_id"),
  lastLogin: timestamp("last_login"),
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  passwordMustChange: boolean("password_must_change").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Systems / Services ───────────────────────────────────────────────────────

export const systems = pgTable("systems", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: text("type").notNull(),          // server, vm, container, storage, service, network
  category: text("category").notNull(), // compute, storage, network, application
  environment: text("environment").notNull().default("produccion"),
  description: text("description"),
  tags: text("tags").array().notNull().default(emptyArray),
  connectorType: connectorTypeEnum("connector_type"),
  connectorId: text("connector_id"),    // ID en el sistema origen
  metadata: jsonb("metadata").default({}),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Alerts ───────────────────────────────────────────────────────────────────

export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  externalId: text("external_id"),
  source: connectorTypeEnum("source").notNull(),
  systemId: uuid("system_id").references(() => systems.id),
  title: text("title").notNull(),
  description: text("description"),
  severity: severityEnum("severity").notNull(),
  tags: text("tags").array().notNull().default(emptyArray),
  acknowledged: boolean("acknowledged").notNull().default(false),
  acknowledgedBy: uuid("acknowledged_by").references(() => users.id),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolved: boolean("resolved").notNull().default(false),
  resolvedAt: timestamp("resolved_at"),
  incidentId: uuid("incident_id"),
  metadata: jsonb("metadata").default({}),
  firedAt: timestamp("fired_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  externalIdx: index("alerts_external_idx").on(t.externalId, t.source),
  severityIdx: index("alerts_severity_idx").on(t.severity),
  resolvedIdx: index("alerts_resolved_idx").on(t.resolved),
}));

// ─── Incidents ────────────────────────────────────────────────────────────────

export const incidents = pgTable("incidents", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  severity: severityEnum("severity").notNull(),
  status: incidentStatusEnum("status").notNull().default("abierta"),
  systemId: uuid("system_id").references(() => systems.id),
  assignedTo: uuid("assigned_to").references(() => users.id),
  createdBy: uuid("created_by").references(() => users.id),
  tags: text("tags").array().notNull().default(emptyArray),
  rootCause: text("root_cause"),
  resolution: text("resolution"),
  impact: text("impact"),
  kbArticleId: uuid("kb_article_id"),
  metadata: jsonb("metadata").default({}),
  resolvedAt: timestamp("resolved_at"),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  statusIdx: index("incidents_status_idx").on(t.status),
  severityIdx: index("incidents_severity_idx").on(t.severity),
  assignedIdx: index("incidents_assigned_idx").on(t.assignedTo),
}));

export const incidentAlerts = pgTable("incident_alerts", {
  incidentId: uuid("incident_id").notNull().references(() => incidents.id, { onDelete: "cascade" }),
  alertId: uuid("alert_id").notNull().references(() => alerts.id, { onDelete: "cascade" }),
  linkedAt: timestamp("linked_at").notNull().defaultNow(),
});

export const checklistItems = pgTable("checklist_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  incidentId: uuid("incident_id").notNull().references(() => incidents.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  completed: boolean("completed").notNull().default(false),
  completedBy: uuid("completed_by").references(() => users.id),
  completedAt: timestamp("completed_at"),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const incidentComments = pgTable("incident_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  incidentId: uuid("incident_id").notNull().references(() => incidents.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  isSystemMessage: boolean("is_system_message").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Automations ──────────────────────────────────────────────────────────────

export const automationActions = pgTable("automation_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),    // health-check, restart, snapshot, cleanup, validate
  icon: text("icon"),
  targetType: text("target_type").notNull(), // connector, system, all
  connectorType: connectorTypeEnum("connector_type"),
  parameters: jsonb("parameters").notNull().default([]),  // [{name, type, label, required, default}]
  script: text("script"),                  // inline script or job name
  jobName: text("job_name").notNull().unique(),
  requiredRole: userRoleEnum("required_role").notNull().default("tecnico"),
  dangerous: boolean("dangerous").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const automationRuns = pgTable("automation_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actionId: uuid("action_id").notNull().references(() => automationActions.id),
  triggeredBy: uuid("triggered_by").notNull().references(() => users.id),
  incidentId: uuid("incident_id").references(() => incidents.id),
  systemId: uuid("system_id").references(() => systems.id),
  parameters: jsonb("parameters").notNull().default({}),
  status: automationStatusEnum("status").notNull().default("pendiente"),
  output: text("output"),
  error: text("error"),
  jobId: text("job_id"),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  statusIdx: index("runs_status_idx").on(t.status),
  actionIdx: index("runs_action_idx").on(t.actionId),
}));

// ─── Knowledge Base ───────────────────────────────────────────────────────────

export const kbArticles = pgTable("kb_articles", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  summary: text("summary"),
  tags: text("tags").array().notNull().default(emptyArray),
  systemId: uuid("system_id").references(() => systems.id),
  sourceIncidentId: uuid("source_incident_id").references(() => incidents.id),
  autoGenerated: boolean("auto_generated").notNull().default(false),
  published: boolean("published").notNull().default(true),
  viewCount: integer("view_count").notNull().default(0),
  helpful: integer("helpful").notNull().default(0),
  notHelpful: integer("not_helpful").notNull().default(0),
  createdBy: uuid("created_by").references(() => users.id),
  updatedBy: uuid("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Audit Events ─────────────────────────────────────────────────────────────

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  action: auditActionEnum("action").notNull(),
  entityType: text("entity_type").notNull(),  // incident, automation_run, kb_article, user, system
  entityId: text("entity_id"),
  entityName: text("entity_name"),
  description: text("description").notNull(),
  changes: jsonb("changes"),               // {before, after} for updates
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  userIdx: index("audit_user_idx").on(t.userId),
  entityIdx: index("audit_entity_idx").on(t.entityType, t.entityId),
  createdIdx: index("audit_created_idx").on(t.createdAt),
}));

// ─── Connector Status ─────────────────────────────────────────────────────────

export const connectorStatus = pgTable("connector_status", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: connectorTypeEnum("type").notNull().unique(),
  name: text("name").notNull(),
  healthy: boolean("healthy").notNull().default(false),
  lastCheck: timestamp("last_check"),
  lastError: text("last_error"),
  latencyMs: integer("latency_ms"),
  metadata: jsonb("metadata").default({}),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  assignedIncidents: many(incidents, { relationName: "assigned" }),
  createdIncidents: many(incidents, { relationName: "created" }),
  auditEvents: many(auditEvents),
}));

export const incidentsRelations = relations(incidents, ({ one, many }) => ({
  system: one(systems, { fields: [incidents.systemId], references: [systems.id] }),
  assignedUser: one(users, { fields: [incidents.assignedTo], references: [users.id], relationName: "assigned" }),
  createdByUser: one(users, { fields: [incidents.createdBy], references: [users.id], relationName: "created" }),
  kbArticle: one(kbArticles, { fields: [incidents.kbArticleId], references: [kbArticles.id] }),
  checklist: many(checklistItems),
  comments: many(incidentComments),
  linkedAlerts: many(incidentAlerts),
  runs: many(automationRuns),
}));

export const alertsRelations = relations(alerts, ({ one }) => ({
  system: one(systems, { fields: [alerts.systemId], references: [systems.id] }),
}));

export const automationRunsRelations = relations(automationRuns, ({ one }) => ({
  action: one(automationActions, { fields: [automationRuns.actionId], references: [automationActions.id] }),
  triggeredByUser: one(users, { fields: [automationRuns.triggeredBy], references: [users.id] }),
  incident: one(incidents, { fields: [automationRuns.incidentId], references: [incidents.id] }),
  system: one(systems, { fields: [automationRuns.systemId], references: [systems.id] }),
}));

export const kbArticlesRelations = relations(kbArticles, ({ one }) => ({
  system: one(systems, { fields: [kbArticles.systemId], references: [systems.id] }),
  sourceIncident: one(incidents, { fields: [kbArticles.sourceIncidentId], references: [incidents.id] }),
  createdByUser: one(users, { fields: [kbArticles.createdBy], references: [users.id] }),
}));

export const auditEventsRelations = relations(auditEvents, ({ one }) => ({
  user: one(users, { fields: [auditEvents.userId], references: [users.id] }),
}));

// ─── SSH Credentials ──────────────────────────────────────────────────────────

export const sshCredentials = pgTable("ssh_credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  host: text("host").notNull(),
  port: integer("port").notNull().default(22),
  username: text("username").notNull(),
  privateKeyEncrypted: text("private_key_encrypted").notNull(),
  passphraseEncrypted: text("passphrase_encrypted"),
  description: text("description"),
  tags: text("tags").array().notNull().default(emptyArray),
  active: boolean("active").notNull().default(true),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Scheduled Jobs ───────────────────────────────────────────────────────────

export const scheduledJobs = pgTable("scheduled_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actionId: uuid("action_id").notNull().references(() => automationActions.id),
  name: text("name").notNull(),
  cronExpression: text("cron_expression").notNull(),
  parameters: jsonb("parameters").notNull().default({}),
  enabled: boolean("enabled").notNull().default(true),
  lastRun: timestamp("last_run"),
  lastRunStatus: text("last_run_status"),
  nextRun: timestamp("next_run"),
  runAsUserId: uuid("run_as_user_id").references(() => users.id),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Notifications ────────────────────────────────────────────────────────────

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  type: notificationTypeEnum("type").notNull().default("info"),
  read: boolean("read").notNull().default(false),
  link: text("link"),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  userUnreadIdx: index("notif_user_unread_idx").on(t.userId, t.read),
  createdIdx: index("notif_created_idx").on(t.createdAt),
}));

// ─── Metric Snapshots ─────────────────────────────────────────────────────────

export const metricSnapshots = pgTable("metric_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: text("source").notNull(),
  metricType: metricTypeEnum("metric_type").notNull(),
  value: integer("value").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  queryIdx: index("metric_query_idx").on(t.source, t.metricType, t.createdAt),
}));

// ─── TOTP Secrets ─────────────────────────────────────────────────────────────

export const totpSecrets = pgTable("totp_secrets", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  secretEncrypted: text("secret_encrypted").notNull(),
  verified: boolean("verified").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── New Relations ────────────────────────────────────────────────────────────

export const sshCredentialsRelations = relations(sshCredentials, ({ one }) => ({
  createdByUser: one(users, { fields: [sshCredentials.createdBy], references: [users.id] }),
}));

export const scheduledJobsRelations = relations(scheduledJobs, ({ one }) => ({
  action: one(automationActions, { fields: [scheduledJobs.actionId], references: [automationActions.id] }),
  runAsUser: one(users, { fields: [scheduledJobs.runAsUserId], references: [users.id], relationName: "runAs" }),
  createdByUser: one(users, { fields: [scheduledJobs.createdBy], references: [users.id], relationName: "createdBy" }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const totpSecretsRelations = relations(totpSecrets, ({ one }) => ({
  user: one(users, { fields: [totpSecrets.userId], references: [users.id] }),
}));
