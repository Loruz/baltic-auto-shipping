/**
 * Database client. One postgres-js pool per process; import `db` for queries.
 * Apps parse env first (@bas/config/env); this module only needs DATABASE_URL.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

export function createDb(url: string, options: postgres.Options<Record<string, never>> = {}) {
  const client = postgres(url, { max: 10, ...options });
  return { db: drizzle(client, { schema }), client };
}

export type Db = ReturnType<typeof createDb>["db"];
export { schema };
