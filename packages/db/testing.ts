/**
 * Test helper: runs `fn` against a freshly migrated scratch database (<db>_<suffix>) and drops it
 * afterwards, so tests never touch the development database.
 */
import postgres from "postgres";
import { runMigrations } from "./migrate.ts";

export async function withScratchDatabase<T>(
  baseUrl: string,
  suffix: string,
  fn: (url: string) => Promise<T>,
): Promise<T> {
  const url = new URL(baseUrl);
  const name = `${url.pathname.slice(1)}_${suffix}`;
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error(`Unsafe scratch database name: ${name}`);
  url.pathname = `/${name}`;

  const admin = postgres(baseUrl, { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(`drop database if exists "${name}" with (force)`);
    await admin.unsafe(`create database "${name}"`);
    await runMigrations(url.toString());
    return await fn(url.toString());
  } finally {
    await admin.unsafe(`drop database if exists "${name}" with (force)`);
    await admin.end();
  }
}
