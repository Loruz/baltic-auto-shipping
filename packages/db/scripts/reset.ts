/**
 * Drops and recreates the database schema, then migrates (plan §9 "Database during development":
 * until the first production deploy the schema is rebuilt instead of migrated forward).
 */
import postgres from "postgres";
import { runMigrations } from "../migrate.ts";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
if (process.env.APP_ENV === "production")
  throw new Error("db:reset refuses to run when APP_ENV=production");

const sql = postgres(url, { max: 1, onnotice: () => {} });
await sql.unsafe(
  "drop schema if exists drizzle cascade; drop schema public cascade; create schema public;",
);
await sql.end();
await runMigrations(url);
console.log("database reset and migrated");
