import { Client } from "ssh2";
import { db, schema } from "../db";
import { eq } from "drizzle-orm";
import { decrypt } from "./encryptionService";
import { logger } from "../utils/logger";
import { NotFoundError } from "../utils/errors";

export async function executeSSHCommand(
  credentialId: string,
  command: string,
  onData: (chunk: string) => void,
): Promise<string> {
  // 1. Load credential from DB
  const [cred] = await db
    .select()
    .from(schema.sshCredentials)
    .where(eq(schema.sshCredentials.id, credentialId))
    .limit(1);

  if (!cred) throw new NotFoundError("Credencial SSH");

  // 2. Decrypt private key
  const privateKey = decrypt(cred.privateKeyEncrypted);
  const passphrase = cred.passphraseEncrypted ? decrypt(cred.passphraseEncrypted) : undefined;

  const output: string[] = [];

  return new Promise((resolve, reject) => {
    const conn = new Client();

    const timeout = setTimeout(() => {
      conn.end();
      reject(new Error(`Timeout de conexión SSH a ${cred.host}:${cred.port}`));
    }, 30000);

    conn.on("ready", () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timeout);
          conn.end();
          return reject(new Error(`SSH exec error: ${err.message}`));
        }

        stream.on("data", (data: Buffer) => {
          const chunk = data.toString("utf8");
          output.push(chunk);
          onData(chunk);
        });

        stream.stderr.on("data", (data: Buffer) => {
          const chunk = data.toString("utf8");
          output.push(chunk);
          onData(chunk);
        });

        stream.on("close", (code: number) => {
          clearTimeout(timeout);
          conn.end();
          if (code !== 0) {
            reject(new Error(`SSH command exited with code ${code}`));
          } else {
            resolve(output.join(""));
          }
        });
      });
    });

    conn.on("error", (err) => {
      clearTimeout(timeout);
      const msg = err.message.includes("ECONNREFUSED")
        ? `Conexión rechazada en ${cred.host}:${cred.port} — host inaccesible o SSH no está corriendo`
        : err.message.includes("ETIMEDOUT")
        ? `Timeout conectando a ${cred.host}:${cred.port}`
        : err.message.includes("ENOTFOUND")
        ? `Host ${cred.host} no encontrado (DNS)`
        : `Error SSH: ${err.message}`;
      reject(new Error(msg));
    });

    try {
      conn.connect({
        host: cred.host,
        port: cred.port,
        username: cred.username,
        privateKey,
        passphrase,
        readyTimeout: 20000,
      });
    } catch (err: any) {
      clearTimeout(timeout);
      reject(new Error(`Error iniciando conexión SSH: ${err.message}`));
    }
  });
}
