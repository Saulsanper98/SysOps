import { db, schema } from "../db";
import type { FastifyRequest } from "fastify";

interface AuditParams {
  userId?: string;
  action: typeof schema.auditEvents.$inferInsert["action"];
  entityType: string;
  entityId?: string;
  entityName?: string;
  description: string;
  changes?: { before?: unknown; after?: unknown };
  metadata?: Record<string, unknown>;
  req?: FastifyRequest;
}

export async function recordAudit(params: AuditParams): Promise<void> {
  await db.insert(schema.auditEvents).values({
    userId: params.userId ?? null,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    entityName: params.entityName,
    description: params.description,
    changes: params.changes ?? null,
    ipAddress: params.req?.ip ?? null,
    userAgent: params.req?.headers["user-agent"] ?? null,
    metadata: params.metadata ?? {},
  });
}
