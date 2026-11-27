/**
 * Sign-up and staff creation against a real, freshly migrated Postgres (plan §4.2, §5).
 * Needs DATABASE_URL (local compose or CI); runs on its own scratch database.
 */
import { parseServerEnv } from "@bas/config/env";
import { createDb, type Db } from "@bas/db";
import { withScratchDatabase } from "@bas/db/testing";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createAuth, type Auth } from "./auth-config";

const baseUrl = process.env.DATABASE_URL;

describe.skipIf(!baseUrl)("auth against Postgres", () => {
  let auth: Auth;
  let db: Db;
  let release: () => void;
  let done: Promise<void>;
  const sendEmail = vi.fn().mockResolvedValue(undefined);

  beforeAll(async () => {
    // Keep the scratch database alive for the whole suite; dropped in afterAll.
    await new Promise<void>((ready) => {
      done = withScratchDatabase(baseUrl!, "auth_test", async (url) => {
        const created = createDb(url, { max: 2 });
        db = created.db;
        auth = createAuth({
          env: parseServerEnv({ ...process.env, DATABASE_URL: url }),
          db,
          sendEmail,
        });
        ready();
        await new Promise<void>((resolve) => (release = resolve));
        await created.client.end();
      });
    });
  });

  afterAll(async () => {
    release?.();
    await done;
  });

  it("sign-up creates a customer with a profile and an empty buying-power account", async () => {
    // Through the HTTP handler, as the browser does (the confirmation email runs after commit).
    const origin = process.env.BETTER_AUTH_URL!;
    const response = await auth.handler(
      new Request(`${origin}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "content-type": "application/json", origin },
        body: JSON.stringify({
          name: "Customer A",
          email: "a@demo.invalid",
          password: "correct-horse-1",
        }),
      }),
    );
    expect(response.status).toBe(200);
    const { user } = (await response.json()) as { user: { id: string } };

    const row = await db.query.user.findFirst({ where: (u, { eq }) => eq(u.id, user.id) });
    expect(row?.role).toBe("customer");
    expect(row?.emailVerified).toBe(false);

    const profile = await db.query.customerProfiles.findFirst({
      where: (p, { eq }) => eq(p.userId, user.id),
    });
    expect(profile?.locale).toBe("lt");

    const account = await db.query.buyingPowerAccounts.findFirst({
      where: (a, { eq }) => eq(a.userId, user.id),
    });
    expect(account).toMatchObject({ grantedUsdCents: 0, reservedUsdCents: 0, consumedUsdCents: 0 });

    // The confirmation email goes out after the commit.
    await vi.waitFor(() =>
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "a@demo.invalid",
          text: expect.stringContaining("verify-email"),
        }),
      ),
    );
  });

  it("rejects passwords shorter than 10 characters", async () => {
    await expect(
      auth.api.signUpEmail({ body: { name: "B", email: "b@demo.invalid", password: "short-pw" } }),
    ).rejects.toThrow();
  });

  it("creates staff with a valid role and rejects unknown roles", async () => {
    const { user } = await auth.api.createUser({
      body: { email: "op@demo.invalid", password: "operator-pass-1", name: "Op", role: "operator" },
    });
    expect(user.role).toBe("operator");

    await expect(
      auth.api.createUser({
        body: {
          email: "x@demo.invalid",
          password: "whatever-pass-1",
          name: "X",
          role: "user" as never,
        },
      }),
    ).rejects.toThrow();
  });
});
