# Architecture

A **TypeScript modular monolith** (decision B6): one Next.js app, one worker process, Postgres and
Redis, all in one pnpm + Turborepo workspace. Business logic lives in domain packages, and the two
apps are thin shells around them.

```
            ┌──────────── apps/web (Next.js) ────────────┐   ┌──── apps/worker (BullMQ) ────┐
            │ pages · server actions · /api/webhooks/*   │   │ critical · sync · maintenance │
            └───────────────┬────────────────────────────┘   └──────────────┬───────────────┘
                            │  both import domain packages, never each other │
   ┌────────────┬───────────┼──────────┬───────────┬──────────┬─────────────┼─────────┐
 auctions    pricing     bidding    billing       kyc      search    notifications   i18n
   └────────────┴───────────┴──────────┴─────┬─────┴──────────┴─────────────┘
                                             db  (Drizzle schema, migrations)
                                           config (tsconfig, eslint, env schema)
```

## Dependency rules

1. **Apps depend on packages, packages never depend on apps.** ESLint enforces this
   (`no-restricted-imports` in `packages/config/eslint.config.js`).
2. **`web` and `worker` never import each other.** They communicate through Postgres rows and
   BullMQ jobs, for example a webhook stores the event and the `stripe.process` job handles it.
3. **Domain packages may depend on `db`, `config` and other domain packages, without cycles.**
   Database enums are the single source for status types; for example,
   `BidStatus = typeof bidStatus.enumValues[number]`.
4. **Packages ship TypeScript source** (`exports` → `src/index.ts`), with no per-package build.
   Next.js compiles them through `transpilePackages`, and the worker bundles them with tsup.

## Providers behind interfaces

Every external service sits behind an interface, and an environment switch picks the adapter.
Locally, everything runs offline (plan §6):

| Switch | Interface | Production | Local / demo |
|---|---|---|---|
| `LOT_PROVIDER` | `LotDataProvider` (`@bas/auctions`) | `apibara` | `fixtures` (replays `docs/phase-0/trial-results/`) |
| `KYC_PROVIDER` | `KycProvider` (`@bas/kyc`) | `ondato` | `fake` |
| `PAYMENT_PROVIDER` | `PaymentProvider` (`@bas/billing`) | `stripe` | `fake` |
| `EMAIL_TRANSPORT` | `@bas/notifications` | `resend` | `smtp` → Mailpit |
| `TELEGRAM_TRANSPORT` | `@bas/notifications` | `bot` | `log` |

`parseServerEnv()` (`@bas/config/env`) refuses to start with any stand-in when `APP_ENV=production`.

## Runtime

- **Web:** Next.js App Router. `/[locale]` (lt, en) serves public and account pages, `/admin` the
  operator console (a separate root layout), and `/api/webhooks/*` the provider callbacks.
  Server-only singletons (`src/server/`) are created lazily, so `next build` needs no runtime env.
- **Auth:** Better Auth (`apps/web/src/server/auth-config.ts`, a factory shared by the app, the
  staff CLI and the tests). Roles `customer` / `operator` / `admin` (`src/lib/permissions.ts`).
  Access checks are `requireUser()` / `requireStaff()` in `src/server/session.ts`; `src/proxy.ts`
  only short-circuits requests that have no session cookie. Staff need TOTP 2FA before any
  `/admin` console page renders. A Postgres trigger (`migrations/0001_user_bootstrap.sql`) gives
  every new user a `customer_profiles` row and a buying-power account in the same transaction.
- **Worker:** queues and schedules are declared in `apps/worker/src/queues.ts`, and processors are
  keyed by job name in `processors.ts`. Every scheduled job must have a processor (a unit test
  checks this).
- **Database:** `packages/db/schema.ts` is the source of truth (B10). Until the first production
  deploy the schema is rebuilt (`pnpm db:reset`), not migrated forward (plan §9).
- **Deploy:** CI builds the `web`, `worker` and `migrate` images. On the server, `migrate` runs
  first, and a failure stops the deploy (plan §6).

## Where things go

| You are adding… | Put it in |
|---|---|
| A business rule or transaction | The domain package that owns it, with tests next to it |
| A page or route | `apps/web/src/app/...`, calling the package |
| A background or scheduled job | A processor in `apps/worker/src/processors.ts` plus an entry in `queues.ts` |
| A table or column | `packages/db/schema.ts`, then `pnpm db:generate` |
| A UI string | `packages/i18n/messages/{lt,en}.json` (both, the test checks the keys match) |
| A new environment variable | `packages/config/src/env.ts` and `.env.example` |
