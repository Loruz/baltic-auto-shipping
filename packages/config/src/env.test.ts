import { describe, expect, it } from "vitest";
import { DEV_AUTH_SECRET, parseServerEnv } from "./env.ts";

const base = {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  REDIS_URL: "redis://localhost:6379",
  BETTER_AUTH_SECRET: "a-test-secret-that-is-at-least-32-chars",
  BETTER_AUTH_URL: "http://localhost:3000",
};

const realProviders = {
  LOT_PROVIDER: "apibara",
  KYC_PROVIDER: "ondato",
  PAYMENT_PROVIDER: "stripe",
  EMAIL_TRANSPORT: "resend",
  TELEGRAM_TRANSPORT: "bot",
};

describe("parseServerEnv", () => {
  it("defaults to the fully offline development setup", () => {
    const env = parseServerEnv(base);
    expect(env).toMatchObject({
      APP_ENV: "development",
      LOT_PROVIDER: "fixtures",
      PAYMENT_PROVIDER: "fake",
    });
  });

  it("refuses stand-in providers in production", () => {
    expect(() => parseServerEnv({ ...base, APP_ENV: "production" })).toThrow(
      /not allowed when APP_ENV=production/,
    );
  });

  it("refuses the development auth secret in production", () => {
    expect(() =>
      parseServerEnv({
        ...base,
        ...realProviders,
        APP_ENV: "production",
        BETTER_AUTH_SECRET: DEV_AUTH_SECRET,
      }),
    ).toThrow(/development BETTER_AUTH_SECRET/);
  });

  it("requires an auth secret of at least 32 characters", () => {
    expect(() => parseServerEnv({ ...base, BETTER_AUTH_SECRET: "short" })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
  });

  it("accepts production with real providers", () => {
    const env = parseServerEnv({ ...base, ...realProviders, APP_ENV: "production" });
    expect(env.APP_ENV).toBe("production");
  });
});
