import "server-only";
import { Redis } from "ioredis";
import { getEnv } from "./env";

// One connection per process, kept on globalThis so dev hot reloads don't open new ones.
const store = globalThis as unknown as { basRedis?: Redis };

export function getRedis(): Redis {
  store.basRedis ??= new Redis(getEnv().REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
  return store.basRedis;
}
