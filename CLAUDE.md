# Baltic Auto Shipping

Car auction platform. The plan is `docs/IMPLEMENTATION-PLAN.md` (decisions B1–B15, flows in §4,
milestones in §8, development defaults in §10). Architecture and dependency rules are in
`docs/ARCHITECTURE.md`; read it before adding a package or crossing package boundaries.

## Commands

- `pnpm lint && pnpm typecheck && pnpm test`: run all three before calling work done.
- `pnpm infra:up && pnpm db:migrate`: local Postgres, Redis and Mailpit.
- `pnpm db:constraint-tests`: database rule tests, on a scratch database.
- `pnpm --filter @bas/<name> <script>`: run in one package.

## Conventions

- **Money:** integer cents (`bigint`, mode number). The name carries the currency: `_usd_cents`,
  `_eur_cents`. Never floats. Buying power, bids and plan limits are USD; deposits, refunds and
  forfeits are EUR (B14).
- **Time:** `timestamptz` in UTC. The bid cutoff is measured from `lots.sale_at`, the auction
  session start.
- **Status types come from the DB enums** (`typeof bidStatus.enumValues[number]`). Don't
  redeclare them.
- **External services sit behind interfaces**, switched by env (`LOT_PROVIDER`, `KYC_PROVIDER`,
  `PAYMENT_PROVIDER`, …). Stand-ins must never run when `APP_ENV=production`.
- **Packages never import apps; `web` and `worker` never import each other.**
- **Imports inside packages use explicit `.ts` extensions** (`./env.ts`). In `apps/web`, use the
  `@/` alias.
- **Dependencies are pinned to exact versions.**
- **Schema changes before the first production deploy:** edit `schema.ts` and regenerate
  `0000_init.sql`; don't stack migrations (§9).
- **Work waiting on the broker is marked ⏳ A1** in the plan. Build the development default from
  §10 instead.
