/**
 * Runs constraint-tests.sql against a scratch database, so the dev database is untouched.
 * Milestone 1 ports these cases to Vitest + Testcontainers.
 */
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { withScratchDatabase } from "../testing.ts";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

// psql meta-commands (\set, \echo) are not SQL; ON_ERROR_STOP is the default here anyway.
const file = await readFile(new URL("../constraint-tests.sql", import.meta.url), "utf8");
const script = file
  .split("\n")
  .filter((line) => !line.startsWith("\\"))
  .join("\n");

const passed = await withScratchDatabase(url, "constraints", async (scratchUrl) => {
  const sql = postgres(scratchUrl, { max: 1, onnotice: (notice) => console.log(notice.message) });
  try {
    await sql.unsafe(script);
    return true;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return false;
  } finally {
    await sql.end();
  }
});

console.log(passed ? "ALL CONSTRAINT TESTS PASSED" : "CONSTRAINT TESTS FAILED");
process.exit(passed ? 0 : 1);
