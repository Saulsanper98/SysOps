import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { config } from "../config";
import { logger } from "../utils/logger";

const queryClient = postgres(config.DATABASE_URL, {
  max: 20,
  idle_timeout: 30,
  connect_timeout: 10,
  onnotice: () => {},
});

export const db = drizzle(queryClient, { schema, logger: false });

export async function checkDbConnection(): Promise<boolean> {
  try {
    await queryClient`SELECT 1`;
    return true;
  } catch (err) {
    logger.error({ err }, "DB connection failed");
    return false;
  }
}

export { schema };
