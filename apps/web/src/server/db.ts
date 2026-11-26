import "server-only";
import { createDb } from "@bas/db";
import { getEnv } from "./env";

// One pool per process, kept on globalThis so dev hot reloads don't open new pools.
const store = globalThis as unknown as { basDb?: ReturnType<typeof createDb> };

export function getDb() {
  store.basDb ??= createDb(getEnv().DATABASE_URL);
  return store.basDb;
}
