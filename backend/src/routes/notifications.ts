import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db, schema } from "../db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../auth/middleware";
import { NotFoundError, ForbiddenError } from "../utils/errors";

export async function notificationRoutes(app: FastifyInstance) {
  // GET / — list notifications for authenticated user
  app.get("/", { preHandler: requireAuth }, async (req) => {
    const query = z.object({
      unreadOnly: z.string().optional(),
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(100).default(20),
    }).parse(req.query);

    const offset = (query.page - 1) * query.limit;

    const conditions = [eq(schema.notifications.userId, req.user.sub)];
    if (query.unreadOnly === "true") {
      conditions.push(eq(schema.notifications.read, false));
    }

    const notifications = await db
      .select()
      .from(schema.notifications)
      .where(and(...conditions))
      .orderBy(schema.notifications.createdAt)
      .limit(query.limit)
      .offset(offset);

    return notifications;
  });

  // GET /count — unread count
  app.get("/count", { preHandler: requireAuth }, async (req) => {
    const result = await db
      .select({ id: schema.notifications.id })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, req.user.sub),
          eq(schema.notifications.read, false),
        ),
      );

    return { unreadCount: result.length };
  });

  // PATCH /:id/read — mark as read
  app.patch("/:id/read", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };

    const [notif] = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.id, id))
      .limit(1);

    if (!notif) throw new NotFoundError("Notificación");
    if (notif.userId !== req.user.sub) throw new ForbiddenError();

    await db
      .update(schema.notifications)
      .set({ read: true })
      .where(eq(schema.notifications.id, id));

    return reply.send({ ok: true });
  });

  // PATCH /read-all — mark all as read
  app.patch("/read-all", { preHandler: requireAuth }, async (req, reply) => {
    await db
      .update(schema.notifications)
      .set({ read: true })
      .where(
        and(
          eq(schema.notifications.userId, req.user.sub),
          eq(schema.notifications.read, false),
        ),
      );

    return reply.send({ ok: true });
  });

  // DELETE /:id — delete notification
  app.delete("/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };

    const [notif] = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.id, id))
      .limit(1);

    if (!notif) throw new NotFoundError("Notificación");
    if (notif.userId !== req.user.sub) throw new ForbiddenError();

    await db
      .delete(schema.notifications)
      .where(eq(schema.notifications.id, id));

    return reply.send({ ok: true });
  });
}
