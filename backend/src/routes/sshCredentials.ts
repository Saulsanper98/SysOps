import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db, schema } from "../db";
import { eq } from "drizzle-orm";
import { requireRole } from "../auth/middleware";
import { encrypt } from "../services/encryptionService";
import { executeSSHCommand } from "../services/sshService";
import { NotFoundError } from "../utils/errors";
import { recordAudit } from "../utils/audit";

export async function sshCredentialRoutes(app: FastifyInstance) {
  // GET / — list without returning keys
  app.get("/", { preHandler: requireRole("admin") }, async () => {
    const creds = await db
      .select({
        id: schema.sshCredentials.id,
        name: schema.sshCredentials.name,
        host: schema.sshCredentials.host,
        port: schema.sshCredentials.port,
        username: schema.sshCredentials.username,
        description: schema.sshCredentials.description,
        tags: schema.sshCredentials.tags,
        active: schema.sshCredentials.active,
        createdAt: schema.sshCredentials.createdAt,
        updatedAt: schema.sshCredentials.updatedAt,
      })
      .from(schema.sshCredentials)
      .orderBy(schema.sshCredentials.name);

    return creds;
  });

  // POST / — create
  app.post("/", { preHandler: requireRole("admin") }, async (req, reply) => {
    const body = z.object({
      name: z.string().min(1),
      host: z.string().min(1),
      port: z.number().int().positive().default(22),
      username: z.string().min(1),
      privateKey: z.string().min(1),
      passphrase: z.string().optional(),
      description: z.string().optional(),
      tags: z.array(z.string()).default([]),
    }).parse(req.body);

    const privateKeyEncrypted = encrypt(body.privateKey);
    const passphraseEncrypted = body.passphrase ? encrypt(body.passphrase) : undefined;

    const [cred] = await db
      .insert(schema.sshCredentials)
      .values({
        name: body.name,
        host: body.host,
        port: body.port,
        username: body.username,
        privateKeyEncrypted,
        passphraseEncrypted,
        description: body.description,
        tags: body.tags,
        createdBy: req.user.sub,
      })
      .returning({
        id: schema.sshCredentials.id,
        name: schema.sshCredentials.name,
        host: schema.sshCredentials.host,
        port: schema.sshCredentials.port,
        username: schema.sshCredentials.username,
      });

    await recordAudit({
      userId: req.user.sub,
      action: "create",
      entityType: "ssh_credential",
      entityId: cred.id,
      entityName: cred.name,
      description: `${req.user.username} creó credencial SSH: ${body.name} (${body.host})`,
      req,
    });

    return reply.status(201).send(cred);
  });

  // PUT/PATCH /:id — update
  const handleUpdateCred = async (req: any, reply: any) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      name: z.string().min(1).optional(),
      host: z.string().min(1).optional(),
      port: z.number().int().positive().optional(),
      username: z.string().min(1).optional(),
      privateKey: z.string().optional(),
      passphrase: z.string().optional(),
      description: z.string().optional(),
      tags: z.array(z.string()).optional(),
      active: z.boolean().optional(),
    }).parse(req.body);

    const [existing] = await db
      .select()
      .from(schema.sshCredentials)
      .where(eq(schema.sshCredentials.id, id))
      .limit(1);
    if (!existing) throw new NotFoundError("Credencial SSH");

    const updates: Record<string, unknown> = {
      name: body.name,
      host: body.host,
      port: body.port,
      username: body.username,
      description: body.description,
      tags: body.tags,
      active: body.active,
      updatedAt: new Date(),
    };

    if (body.privateKey) {
      updates.privateKeyEncrypted = encrypt(body.privateKey);
    }
    if (body.passphrase !== undefined) {
      updates.passphraseEncrypted = body.passphrase ? encrypt(body.passphrase) : null;
    }

    // Remove undefined values
    for (const key of Object.keys(updates)) {
      if (updates[key] === undefined) delete updates[key];
    }

    await db
      .update(schema.sshCredentials)
      .set(updates as any)
      .where(eq(schema.sshCredentials.id, id));

    return reply.send({ ok: true });
  };
  app.put("/:id", { preHandler: requireRole("admin") }, handleUpdateCred);
  app.patch("/:id", { preHandler: requireRole("admin") }, handleUpdateCred);

  // DELETE /:id
  app.delete("/:id", { preHandler: requireRole("admin") }, async (req, reply) => {
    const { id } = req.params as { id: string };

    const [existing] = await db
      .select()
      .from(schema.sshCredentials)
      .where(eq(schema.sshCredentials.id, id))
      .limit(1);
    if (!existing) throw new NotFoundError("Credencial SSH");

    await db.delete(schema.sshCredentials).where(eq(schema.sshCredentials.id, id));

    await recordAudit({
      userId: req.user.sub,
      action: "delete",
      entityType: "ssh_credential",
      entityId: id,
      entityName: existing.name,
      description: `${req.user.username} eliminó credencial SSH: ${existing.name}`,
      req,
    });

    return reply.send({ ok: true });
  });

  // POST /:id/test — test SSH connection
  app.post("/:id/test", { preHandler: requireRole("admin") }, async (req, reply) => {
    const { id } = req.params as { id: string };

    const [existing] = await db
      .select({ id: schema.sshCredentials.id })
      .from(schema.sshCredentials)
      .where(eq(schema.sshCredentials.id, id))
      .limit(1);
    if (!existing) throw new NotFoundError("Credencial SSH");

    try {
      const output = await executeSSHCommand(id, "echo ok", () => {});
      return reply.send({ ok: true, output: output.trim() });
    } catch (err: any) {
      return reply.status(400).send({ ok: false, error: err.message });
    }
  });
}
