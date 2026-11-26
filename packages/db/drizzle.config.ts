// drizzle-kit config (dev only; production migrates through migrate.ts).
import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile("../../.env"); // one .env at the repo root (see .env.example)
} catch {
  // No root .env: variables come from the environment.
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./schema.ts",
  out: "./migrations", // SQL + meta/_journal.json + snapshots — commit all of it
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/bas",
  },
  strict: true,
  verbose: true,
});
