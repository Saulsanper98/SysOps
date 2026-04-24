import bcrypt from "bcryptjs";
import { db, schema } from "../db";
import { eq } from "drizzle-orm";
import { UnauthorizedError } from "../utils/errors";
import { logger } from "../utils/logger";
import { recordAudit } from "../utils/audit";
import { checkBruteForce, recordFailedAttempt, clearBruteForce } from "./bruteForce";
import type { FastifyRequest, FastifyReply } from "fastify";

export interface JWTPayload {
  sub: string;       // userId
  username: string;
  role: string;
  displayName: string;
}

export async function loginWithPassword(
  username: string,
  password: string,
  req: FastifyRequest,
): Promise<{ user: typeof schema.users.$inferSelect; token: string }> {
  await checkBruteForce(username);

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .limit(1);

  if (!user || !user.passwordHash || !user.active) {
    await recordFailedAttempt(username);
    throw new UnauthorizedError("Credenciales incorrectas");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    await recordFailedAttempt(username);
    throw new UnauthorizedError("Credenciales incorrectas");
  }

  await clearBruteForce(username);

  await db
    .update(schema.users)
    .set({ lastLogin: new Date() })
    .where(eq(schema.users.id, user.id));

  const payload: JWTPayload = {
    sub: user.id,
    username: user.username,
    role: user.role,
    displayName: user.displayName,
  };

  const token = (req.server as any).jwt.sign(payload);

  await recordAudit({
    userId: user.id,
    action: "login",
    entityType: "user",
    entityId: user.id,
    entityName: user.username,
    description: `Usuario ${user.username} inició sesión`,
    req,
  });

  logger.info({ userId: user.id, username: user.username }, "Login OK");
  return { user, token };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!user?.passwordHash) throw new UnauthorizedError("Usuario no válido");

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw new UnauthorizedError("Contraseña actual incorrecta");

  const newHash = await hashPassword(newPassword);
  await db
    .update(schema.users)
    .set({ passwordHash: newHash, updatedAt: new Date() })
    .where(eq(schema.users.id, userId));
}
