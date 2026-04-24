import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db, schema } from "../db";
import { eq, ne } from "drizzle-orm";
import { requireAuth, requireRole } from "../auth/middleware";
import { hashPassword } from "../auth";
import { NotFoundError, ForbiddenError, ValidationError } from "../utils/errors";
import { recordAudit } from "../utils/audit";
import crypto from "crypto";

export async function userRoutes(app: FastifyInstance) {
  // GET / — list users (admin only)
  app.get("/", { preHandler: requireRole("admin") }, async (req) => {
    const query = z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(100).default(20),
    }).parse(req.query);

    const offset = (query.page - 1) * query.limit;

    const users = await db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        displayName: schema.users.displayName,
        email: schema.users.email,
        role: schema.users.role,
        active: schema.users.active,
        totpEnabled: schema.users.totpEnabled,
        passwordMustChange: schema.users.passwordMustChange,
        lastLogin: schema.users.lastLogin,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .orderBy(schema.users.displayName)
      .limit(query.limit)
      .offset(offset);

    return users;
  });

  // GET /me — own profile (any authenticated user)
  app.get("/me", { preHandler: requireAuth }, async (req) => {
    const [user] = await db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        displayName: schema.users.displayName,
        email: schema.users.email,
        role: schema.users.role,
        active: schema.users.active,
        avatar: schema.users.avatar,
        totpEnabled: schema.users.totpEnabled,
        passwordMustChange: schema.users.passwordMustChange,
        lastLogin: schema.users.lastLogin,
      })
      .from(schema.users)
      .where(eq(schema.users.id, req.user.sub))
      .limit(1);

    if (!user) throw new NotFoundError("Usuario");
    return user;
  });

  // POST / — create user (admin only)
  app.post("/", { preHandler: requireRole("admin") }, async (req, reply) => {
    const body = z.object({
      username: z.string().min(2),
      email: z.string().email(),
      displayName: z.string().min(1),
      password: z.string().min(8),
      role: z.enum(["admin", "tecnico", "readonly"]).default("tecnico"),
    }).parse(req.body);

    // Check uniqueness
    const existing = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.username, body.username))
      .limit(1);
    if (existing.length > 0) throw new ValidationError("El nombre de usuario ya está en uso");

    const existingEmail = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, body.email))
      .limit(1);
    if (existingEmail.length > 0) throw new ValidationError("El email ya está en uso");

    const hash = await hashPassword(body.password);
    const [user] = await db
      .insert(schema.users)
      .values({ ...body, passwordHash: hash })
      .returning({
        id: schema.users.id,
        username: schema.users.username,
        displayName: schema.users.displayName,
        email: schema.users.email,
        role: schema.users.role,
      });

    await recordAudit({
      userId: req.user.sub,
      action: "create",
      entityType: "user",
      entityId: user.id,
      entityName: user.username,
      description: `Admin ${req.user.username} creó usuario ${body.username}`,
      req,
    });

    return reply.status(201).send(user);
  });

  // PUT /:id — edit user (admin only)
  const handleUpdateUser = async (req: any, reply: any) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      displayName: z.string().min(1).optional(),
      email: z.string().email().optional(),
      role: z.enum(["admin", "tecnico", "readonly"]).optional(),
    }).parse(req.body);

    const [existing] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);
    if (!existing) throw new NotFoundError("Usuario");

    if (body.email && body.email !== existing.email) {
      const dup = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.email, body.email))
        .limit(1);
      if (dup.length > 0) throw new ValidationError("El email ya está en uso");
    }

    await db
      .update(schema.users)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(schema.users.id, id));

    await recordAudit({
      userId: req.user.sub,
      action: "update",
      entityType: "user",
      entityId: id,
      entityName: existing.username,
      description: `Admin ${req.user.username} editó usuario ${existing.username}`,
      changes: { before: existing, after: body },
      req,
    });

    return reply.send({ ok: true });
  };
  app.put("/:id", { preHandler: requireRole("admin") }, handleUpdateUser);
  app.patch("/:id", { preHandler: requireRole("admin") }, handleUpdateUser);

  // PATCH /:id/active — activate/deactivate (admin only)
  app.patch("/:id/active", { preHandler: requireRole("admin") }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { active } = z.object({ active: z.boolean() }).parse(req.body);

    const [existing] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);
    if (!existing) throw new NotFoundError("Usuario");

    await db
      .update(schema.users)
      .set({ active, updatedAt: new Date() })
      .where(eq(schema.users.id, id));

    return reply.send({ ok: true });
  });

  // DELETE /:id — delete user (admin only, cannot delete self)
  app.delete("/:id", { preHandler: requireRole("admin") }, async (req, reply) => {
    const { id } = req.params as { id: string };

    if (id === req.user.sub) {
      throw new ForbiddenError("No puedes eliminar tu propio usuario");
    }

    const [existing] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);
    if (!existing) throw new NotFoundError("Usuario");

    await db.delete(schema.users).where(eq(schema.users.id, id));

    await recordAudit({
      userId: req.user.sub,
      action: "delete",
      entityType: "user",
      entityId: id,
      entityName: existing.username,
      description: `Admin ${req.user.username} eliminó usuario ${existing.username}`,
      req,
    });

    return reply.send({ ok: true });
  });

  // POST /:id/reset-password — generate temp password (admin only)
  app.post("/:id/reset-password", { preHandler: requireRole("admin") }, async (req, reply) => {
    const { id } = req.params as { id: string };

    const [existing] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);
    if (!existing) throw new NotFoundError("Usuario");

    const tempPassword = crypto.randomBytes(8).toString("hex");
    const hash = await hashPassword(tempPassword);

    await db
      .update(schema.users)
      .set({ passwordHash: hash, passwordMustChange: true, updatedAt: new Date() })
      .where(eq(schema.users.id, id));

    await recordAudit({
      userId: req.user.sub,
      action: "update",
      entityType: "user",
      entityId: id,
      entityName: existing.username,
      description: `Admin ${req.user.username} restableció contraseña de ${existing.username}`,
      req,
    });

    return reply.send({ tempPassword });
  });
}
