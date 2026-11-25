/**
 * Runs constraint-tests.sql against a scratch database (<db>_constraints), so the dev
 * database is untouched. Milestone 1 ports these cases to Vitest + Testcontainers.
 */
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { runMigrations } from "../migrate.ts";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const scratchUrl = new URL(url);
const scratchName = `${scratchUrl.pathname.slice(1)}_constraints`;
scratchUrl.pathname = `/${scratchName}`;

const admin = postgres(url, { max: 1, onnotice: () => {} });
await admin.unsafe(`drop database if exists "${scratchName}" with (force)`);
await admin.unsafe(`create database "${scratchName}"`);

let failed = false;
try {
  await runMigrations(scratchUrl.toString());
  // psql meta-commands (\set, \echo) are not SQL; ON_ERROR_STOP is the default here anyway.
  const file = await readFile(new URL("../constraint-tests.sql", import.meta.url), "utf8");
  const script = file
    .split("\n")
    .filter((line) => !line.startsWith("\\"))
    .join("\n");
  const sql = postgres(scratchUrl.toString(), {
    max: 1,
    onnotice: (notice) => console.log(notice.message),
  });
  try {
    await sql.unsafe(script);
    console.log("ALL CONSTRAINT TESTS PASSED");
  } catch (error) {
    failed = true;
    console.error(error instanceof Error ? error.message : error);
  } finally {
    await sql.end();
  }
} finally {
  await admin.unsafe(`drop database if exists "${scratchName}" with (force)`);
  await admin.end();
}
process.exit(failed ? 1 : 0);
