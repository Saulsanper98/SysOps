import IORedis from "ioredis";
import { config } from "../config";
import { AppError } from "../utils/errors";

const redis = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
  lazyConnect: true,
});

const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60;

export async function checkBruteForce(username: string): Promise<void> {
  try {
    const key = `brute:${username}`;
    const count = await redis.get(key);
    if (count && Number(count) >= MAX_ATTEMPTS) {
      const ttl = await redis.ttl(key);
      const mins = Math.ceil(ttl / 60);
      throw new AppError(429, `Demasiados intentos fallidos. Cuenta bloqueada ${mins} min.`, "BRUTE_FORCE");
    }
  } catch (err) {
    if ((err as AppError).code === "BRUTE_FORCE") throw err;
    // Redis unavailable — fail open (don't block logins)
  }
}

export async function recordFailedAttempt(username: string): Promise<void> {
  try {
    const key = `brute:${username}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, WINDOW_SECONDS);
  } catch {
    // Redis unavailable — ignore
  }
}

export async function clearBruteForce(username: string): Promise<void> {
  try {
    await redis.del(`brute:${username}`);
  } catch {
    // Redis unavailable — ignore
  }
}
