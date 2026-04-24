import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { loginWithPassword, changePassword } from "../auth";
import { requireAuth } from "../auth/middleware";
import { db, schema } from "../db";
import { eq } from "drizzle-orm";
import { hashPassword } from "../auth";
import { NotFoundError, ForbiddenError, UnauthorizedError, ValidationError } from "../utils/errors";
import { recordAudit } from "../utils/audit";
import { encrypt, decrypt } from "../services/encryptionService";
import { generateTotpSecret, generateOtpauthUri, generateQrDataUrl, verifyTotpCode } from "../auth/totp";
import { buildAuthUrl, handleCallback } from "../auth/entra";
import { config } from "../config";

export async function authRoutes(app: FastifyInstance) {
  app.post("/login", async (req, reply) => {
    const body = z.object({
      username: z.string().min(1),
      password: z.string().min(1),
    }).parse(req.body);

    const { user, token } = await loginWithPassword(body.username, body.password, req);

    // If TOTP is enabled and verified, require 2FA confirmation
    if (user.totpEnabled) {
      const [totpSecret] = await db
        .select()
        .from(schema.totpSecrets)
        .where(eq(schema.totpSecrets.userId, user.id))
        .limit(1);

      if (totpSecret?.verified) {
        // Issue a short-lived temp token for the 2FA step
        const tempToken = (req.server as any).jwt.sign(
          { sub: user.id, username: user.username, role: user.role, displayName: user.displayName, is2faTemp: true },
          { expiresIn: "5m" },
        );
        return reply.send({ requires2fa: true, tempToken });
      }
    }

    return reply.send({
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        totpEnabled: user.totpEnabled,
        passwordMustChange: user.passwordMustChange,
      },
    });
  });

  app.get("/me", { preHandler: requireAuth }, async (req) => {
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, req.user.sub))
      .limit(1);

    if (!user) throw new NotFoundError("Usuario");

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      lastLogin: user.lastLogin,
    };
  });

  app.post("/logout", { preHandler: requireAuth }, async (req, reply) => {
    await recordAudit({
      userId: req.user.sub,
      action: "logout",
      entityType: "user",
      entityId: req.user.sub,
      entityName: req.user.username,
      description: `Usuario ${req.user.username} cerró sesión`,
      req,
    });
    return reply.send({ ok: true });
  });

  app.put("/change-password", { preHandler: requireAuth }, async (req, reply) => {
    const body = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8),
    }).parse(req.body);

    await changePassword(req.user.sub, body.currentPassword, body.newPassword);
    return reply.send({ ok: true });
  });

  // ─── 2FA endpoints ─────────────────────────────────────────────────────────

  // POST /2fa/setup — generate TOTP secret and QR code
  app.post("/2fa/setup", { preHandler: requireAuth }, async (req) => {
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, req.user.sub))
      .limit(1);
    if (!user) throw new NotFoundError("Usuario");

    const secret = generateTotpSecret();
    const secretEncrypted = encrypt(secret);

    // Upsert totp secret (not yet verified)
    await db
      .insert(schema.totpSecrets)
      .values({ userId: user.id, secretEncrypted, verified: false })
      .onConflictDoUpdate({
        target: schema.totpSecrets.userId,
        set: { secretEncrypted, verified: false, createdAt: new Date() },
      });

    const uri = generateOtpauthUri(secret, user.username);
    const qrDataUrl = await generateQrDataUrl(uri);

    return { qrDataUrl, uri, secret };
  });

  // POST /2fa/verify — verify TOTP code and mark as verified
  app.post("/2fa/verify", { preHandler: requireAuth }, async (req, reply) => {
    const { code } = z.object({ code: z.string().length(6) }).parse(req.body);

    const [totpRecord] = await db
      .select()
      .from(schema.totpSecrets)
      .where(eq(schema.totpSecrets.userId, req.user.sub))
      .limit(1);

    if (!totpRecord) throw new NotFoundError("Configuración TOTP");

    const secret = decrypt(totpRecord.secretEncrypted);
    if (!verifyTotpCode(secret, code)) {
      throw new ValidationError("Código TOTP inválido");
    }

    await db
      .update(schema.totpSecrets)
      .set({ verified: true })
      .where(eq(schema.totpSecrets.userId, req.user.sub));

    await db
      .update(schema.users)
      .set({ totpEnabled: true, updatedAt: new Date() })
      .where(eq(schema.users.id, req.user.sub));

    return reply.send({ ok: true });
  });

  // POST /2fa/disable — disable TOTP (requires current code)
  app.post("/2fa/disable", { preHandler: requireAuth }, async (req, reply) => {
    const { code } = z.object({ code: z.string().length(6) }).parse(req.body);

    const [totpRecord] = await db
      .select()
      .from(schema.totpSecrets)
      .where(eq(schema.totpSecrets.userId, req.user.sub))
      .limit(1);

    if (!totpRecord) throw new NotFoundError("Configuración TOTP");

    const secret = decrypt(totpRecord.secretEncrypted);
    if (!verifyTotpCode(secret, code)) {
      throw new ValidationError("Código TOTP inválido");
    }

    await db.delete(schema.totpSecrets).where(eq(schema.totpSecrets.userId, req.user.sub));
    await db
      .update(schema.users)
      .set({ totpEnabled: false, updatedAt: new Date() })
      .where(eq(schema.users.id, req.user.sub));

    return reply.send({ ok: true });
  });

  // POST /2fa/confirm — accept tempToken + TOTP code, return real JWT
  app.post("/2fa/confirm", async (req, reply) => {
    const { tempToken, code } = z.object({
      tempToken: z.string(),
      code: z.string().length(6),
    }).parse(req.body);

    let payload: any;
    try {
      payload = (req.server as any).jwt.verify(tempToken);
    } catch {
      throw new UnauthorizedError("Token temporal inválido o expirado");
    }

    if (!payload.is2faTemp) throw new UnauthorizedError("Token no es de tipo 2FA");

    const [totpRecord] = await db
      .select()
      .from(schema.totpSecrets)
      .where(eq(schema.totpSecrets.userId, payload.sub))
      .limit(1);

    if (!totpRecord?.verified) throw new UnauthorizedError("2FA no configurado");

    const secret = decrypt(totpRecord.secretEncrypted);
    if (!verifyTotpCode(secret, code)) {
      throw new ValidationError("Código TOTP inválido");
    }

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, payload.sub))
      .limit(1);
    if (!user) throw new NotFoundError("Usuario");

    const token = (req.server as any).jwt.sign({
      sub: user.id,
      username: user.username,
      role: user.role,
      displayName: user.displayName,
    });

    return reply.send({
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        totpEnabled: user.totpEnabled,
      },
    });
  });

  // ─── Entra ID routes ────────────────────────────────────────────────────────

  app.get("/entra/init", async (req, reply) => {
    const url = await buildAuthUrl();
    if (!url) {
      return reply.status(503).send({ error: "Entra ID no está configurado" });
    }
    return reply.redirect(url);
  });

  app.get("/entra/callback", async (req, reply) => {
    const { code } = req.query as { code?: string };
    if (!code) return reply.status(400).send({ error: "Código de autorización requerido" });

    const claims = await handleCallback(code);
    if (!claims) return reply.status(401).send({ error: "No se pudo autenticar con Entra ID" });

    // Find or create user by entraId or email
    let [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.entraId, claims.oid))
      .limit(1);

    if (!user) {
      // Try by email
      const [byEmail] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, claims.email))
        .limit(1);

      if (byEmail) {
        await db
          .update(schema.users)
          .set({ entraId: claims.oid, updatedAt: new Date() })
          .where(eq(schema.users.id, byEmail.id));
        user = { ...byEmail, entraId: claims.oid };
      } else {
        // Create new user with default role
        const username = claims.email.split("@")[0].replace(/[^a-z0-9_]/gi, "").toLowerCase();
        const [newUser] = await db
          .insert(schema.users)
          .values({
            username,
            email: claims.email,
            displayName: claims.displayName,
            entraId: claims.oid,
            role: config.ENTRA_DEFAULT_ROLE,
          })
          .returning();
        user = newUser;
      }
    }

    if (!user.active) return reply.status(401).send({ error: "Usuario desactivado" });

    await db.update(schema.users).set({ lastLogin: new Date() }).where(eq(schema.users.id, user.id));

    const token = (req.server as any).jwt.sign({
      sub: user.id,
      username: user.username,
      role: user.role,
      displayName: user.displayName,
    });

    // Redirect to frontend with token
    return reply.redirect(`${config.FRONTEND_URL}/auth/callback?token=${token}`);
  });

  // ─── Admin: list/create/toggle users (legacy, kept for backward compat) ────

  // Admin: list users
  app.get("/users", { preHandler: requireAuth }, async (req) => {
    if (req.user.role !== "admin") throw new ForbiddenError();
    const users = await db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        displayName: schema.users.displayName,
        email: schema.users.email,
        role: schema.users.role,
        active: schema.users.active,
        lastLogin: schema.users.lastLogin,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .orderBy(schema.users.displayName);
    return users;
  });

  // Admin: create user
  app.post("/users", { preHandler: requireAuth }, async (req, reply) => {
    if (req.user.role !== "admin") throw new ForbiddenError();

    const body = z.object({
      username: z.string().min(2),
      email: z.string().email(),
      displayName: z.string().min(1),
      password: z.string().min(8),
      role: z.enum(["admin", "tecnico", "readonly"]).default("tecnico"),
    }).parse(req.body);

    const hash = await hashPassword(body.password);
    const [user] = await db
      .insert(schema.users)
      .values({ ...body, passwordHash: hash })
      .returning({ id: schema.users.id, username: schema.users.username });

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

  // Admin: toggle user active
  app.patch("/users/:id/active", { preHandler: requireAuth }, async (req, reply) => {
    if (req.user.role !== "admin") throw new ForbiddenError();
    const { id } = req.params as { id: string };
    const { active } = z.object({ active: z.boolean() }).parse(req.body);

    await db.update(schema.users).set({ active, updatedAt: new Date() }).where(eq(schema.users.id, id));
    return reply.send({ ok: true });
  });
}
