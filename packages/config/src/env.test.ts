import { describe, expect, it } from "vitest";
import { parseServerEnv } from "./env.ts";

const base = {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  REDIS_URL: "redis://localhost:6379",
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

  it("accepts production with real providers", () => {
    const env = parseServerEnv({
      ...base,
      APP_ENV: "production",
      LOT_PROVIDER: "apibara",
      KYC_PROVIDER: "ondato",
      PAYMENT_PROVIDER: "stripe",
      EMAIL_TRANSPORT: "resend",
      TELEGRAM_TRANSPORT: "bot",
    });
    expect(env.APP_ENV).toBe("production");
  });
});
