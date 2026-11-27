# Baltic Auto Shipping

Car auction platform for Baltic Auto Shipping: customers browse Copart and IAAI lots, buy a plan
(a refundable deposit that grants buying power), and leave max bids that the broker's staff place
at the live auction. Plan and decisions: [`docs/IMPLEMENTATION-PLAN.md`](docs/IMPLEMENTATION-PLAN.md).
Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Quickstart

Requires Node 24 (`.nvmrc`), pnpm 10 and Docker.

```sh
pnpm install
cp .env.example .env          # fully offline defaults: fixtures, fake KYC, fake payments
pnpm infra:up                 # Postgres 17, Redis 7, Mailpit (http://localhost:8025)
pnpm db:migrate
pnpm dev                      # web on http://localhost:3000, worker in the same terminal
```

`curl localhost:3000/api/health` returns `{"ok":true,...}` when Postgres and Redis are reachable.

## Repository map

```
apps/
  web/              Next.js 16: public site (/lt, /en), customer account, /admin, /api/webhooks/*
  worker/           BullMQ queues (critical, sync, maintenance) and scheduled jobs
packages/
  config/           tsconfig bases, ESLint config, server env schema (@bas/config/env)
  db/               Drizzle schema (source of truth), migrations, migrator, constraint tests
  auctions/         LotDataProvider interface; apibara + fixtures adapters (M3)
  pricing/          calculateLandedCost(), a pure function over rate cards (M5)
  bidding/          bid state machine and bid transactions (M6)
  billing/          PaymentProvider (Stripe, fake), deposits ↔ buying power (M2)
  kyc/              KycProvider (Ondato, fake) (M2)
  search/           Postgres catalogue search (M4)
  notifications/    outbox, templates, email + Telegram senders (M6)
  i18n/             LT + EN messages
infra/              compose (dev + prod draft), Dockerfiles, Caddyfile
docs/               implementation plan, broker questions, Phase 0 research, reviews
```

## Commands

| Command                                                                       | What it does                                                                        |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `pnpm dev`                                                                    | Web + worker with hot reload                                                        |
| `pnpm build`                                                                  | Production builds (Next.js standalone, worker bundle)                               |
| `pnpm lint` / `pnpm typecheck` / `pnpm test`                                  | Checks across every package (Turborepo)                                             |
| `pnpm format`                                                                 | Prettier                                                                            |
| `pnpm db:generate`                                                            | Generate SQL from `packages/db/schema.ts`                                           |
| `pnpm db:migrate`                                                             | Apply migrations                                                                    |
| `pnpm db:reset`                                                               | Drop, recreate and migrate (development only)                                       |
| `pnpm db:constraint-tests`                                                    | Run the database rule tests on a scratch database                                   |
| `pnpm db:dbml`                                                                | Regenerate `packages/db/schema.dbml` for dbdiagram.io                               |
| `pnpm infra:up` / `pnpm infra:down`                                           | Start / stop the local services                                                     |
| `pnpm --filter @bas/web auth:create-staff --email <e> --role admin\|operator` | Create a staff login with a one-time password; 2FA setup is forced at first sign-in |
