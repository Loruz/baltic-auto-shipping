# @bas/db

Drizzle schema (source of truth), generated migrations, migrator and database rule tests.
Plan: `docs/IMPLEMENTATION-PLAN.md` §9 and decision B10.

| File                                                  | What it is                                                                                |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `schema.ts`                                           | Drizzle ORM schema. Edit this, then `pnpm db:generate`                                    |
| `migrations/`                                         | Generated SQL + journal. Commit all of it                                                 |
| `client.ts`                                           | `createDb(url)` → drizzle client with the schema                                          |
| `migrate.ts`                                          | drizzle-orm migrator; runs in the `migrate` image on deploy                               |
| `scripts/reset.ts`                                    | Drop + recreate + migrate (development only, §9)                                          |
| `constraint-tests.sql`, `scripts/constraint-tests.ts` | 14 self-checking rule tests, run on a scratch database                                    |
| `migrations/0001_user_bootstrap.sql`                  | Custom migration: the trigger that creates a profile + buying-power account per user      |
| `testing.ts`                                          | `withScratchDatabase(url, suffix, fn)` for tests that need a migrated, throwaway database |
| `dbml.ts`, `schema.dbml`                              | `pnpm db:dbml` regenerates the dbdiagram.io file                                          |

Until the first production deploy the schema is rebuilt (`pnpm db:reset`) rather than migrated forward:
regenerate `migrations/0000_init.sql` instead of stacking new migrations (custom SQL such as
`0001_user_bootstrap.sql` is kept and re-added after regenerating).
