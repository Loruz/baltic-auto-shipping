import { getDb } from "@/server/db";
import { getRedis } from "@/server/redis";

export const dynamic = "force-dynamic";

async function check(fn: () => Promise<unknown>): Promise<"ok" | "down"> {
  try {
    await fn();
    return "ok";
  } catch {
    return "down";
  }
}

/** Liveness for Caddy / Better Stack: 200 only when Postgres and Redis answer. */
export async function GET() {
  const [database, queue] = await Promise.all([
    check(() => getDb().client`select 1`),
    check(async () => {
      const redis = getRedis();
      if (redis.status === "wait") await redis.connect();
      return redis.ping();
    }),
  ]);
  const ok = database === "ok" && queue === "ok";
  return Response.json({ ok, database, redis: queue }, { status: ok ? 200 : 503 });
}
