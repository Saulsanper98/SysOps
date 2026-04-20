import axios from "axios";
import { config } from "../config";
import { logger } from "../utils/logger";
import { db, schema } from "../db";
import { wsManager } from "./wsManager";

interface TeamsCard {
  type: string;
  title: string;
  text: string;
  themeColor?: string;
  sections?: any[];
  potentialAction?: any[];
}

const severityColor: Record<string, string> = {
  critica: "FF0000",
  alta: "FF6600",
  media: "FFA500",
  baja: "0078D4",
  info: "808080",
};

// ─── In-app Notifications ─────────────────────────────────────────────────────

export interface CreateNotificationData {
  title: string;
  body: string;
  type?: "info" | "warning" | "error" | "success";
  link?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export async function createNotification(
  userId: string,
  data: CreateNotificationData,
): Promise<void> {
  try {
    const [notif] = await db
      .insert(schema.notifications)
      .values({
        userId,
        title: data.title,
        body: data.body,
        type: data.type ?? "info",
        link: data.link,
        entityType: data.entityType,
        entityId: data.entityId,
        metadata: data.metadata ?? {},
      })
      .returning();

    wsManager.emit(userId, { type: "notification", notification: notif });
  } catch (err: any) {
    logger.error({ err: err.message, userId }, "Failed to create notification");
  }
}

// ─── Teams Notifications ──────────────────────────────────────────────────────

export async function sendTeamsAlert(params: {
  title: string;
  text: string;
  severity?: string;
  incidentId?: string;
  fields?: { name: string; value: string }[];
}): Promise<void> {
  if (!config.TEAMS_WEBHOOK_URL) return;

  const card: TeamsCard = {
    type: "MessageCard",
    title: params.title,
    text: params.text,
    themeColor: severityColor[params.severity ?? "info"] ?? "0078D4",
  };

  if (params.fields?.length) {
    card.sections = [
      {
        facts: params.fields.map((f) => ({ name: f.name, value: f.value })),
      },
    ];
  }

  if (params.incidentId) {
    card.potentialAction = [
      {
        "@type": "OpenUri",
        name: "Ver Incidencia",
        targets: [{ os: "default", uri: `${config.FRONTEND_URL}/incidents/${params.incidentId}` }],
      },
    ];
  }

  try {
    await axios.post(config.TEAMS_WEBHOOK_URL, { "@type": "MessageCard", "@context": "https://schema.org/extensions", ...card }, { timeout: 5000 });
    logger.debug({ title: params.title }, "Teams notification sent");
  } catch (err: any) {
    logger.warn({ err: err.message }, "Teams notification failed");
  }
}

export async function notifyNewCriticalIncident(incident: {
  id: string;
  title: string;
  severity: string;
  systemName?: string;
  assignedTo?: string;
}): Promise<void> {
  await sendTeamsAlert({
    title: `🚨 Nueva incidencia ${incident.severity.toUpperCase()}: ${incident.title}`,
    text: `Se ha creado una nueva incidencia que requiere atención inmediata.`,
    severity: incident.severity,
    incidentId: incident.id,
    fields: [
      { name: "Sistema", value: incident.systemName ?? "N/A" },
      { name: "Severidad", value: incident.severity },
      { name: "Asignado a", value: incident.assignedTo ?? "Sin asignar" },
    ],
  });
}
