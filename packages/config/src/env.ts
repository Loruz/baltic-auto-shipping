/**
 * Server environment schema (IMPLEMENTATION-PLAN §6 "Secrets" and "Local and demo environment").
 * Parse once at process start: `const env = parseServerEnv(process.env)`.
 */
import { z } from "zod";

export const APP_ENVS = ["production", "staging", "demo", "development", "test"] as const;
export type AppEnv = (typeof APP_ENVS)[number];

const optional = z.string().trim().min(1).optional().catch(undefined);

/** The secret in .env.example. Fine on a laptop, refused in production. */
export const DEV_AUTH_SECRET = "dev-only-insecure-secret-change-me-0123456789";

export const serverEnvSchema = z
  .object({
    APP_ENV: z.enum(APP_ENVS).default("development"),
    LOT_PROVIDER: z.enum(["apibara", "fixtures"]).default("fixtures"),
    KYC_PROVIDER: z.enum(["ondato", "fake"]).default("fake"),
    PAYMENT_PROVIDER: z.enum(["stripe", "fake"]).default("fake"),
    EMAIL_TRANSPORT: z.enum(["resend", "smtp"]).default("smtp"),
    TELEGRAM_TRANSPORT: z.enum(["bot", "log"]).default("log"),

    DATABASE_URL: z.url(),
    REDIS_URL: z.url(),
    SMTP_URL: z.url().default("smtp://localhost:1025"),

    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    GOOGLE_CLIENT_ID: optional,
    GOOGLE_CLIENT_SECRET: optional,
    STRIPE_SECRET_KEY: optional,
    STRIPE_WEBHOOK_SECRET: optional,
    APIBARA_API_KEY: optional,
    APIBARA_BASE_URL: optional,
    ONDATO_CLIENT_ID: optional,
    ONDATO_CLIENT_SECRET: optional,
    ONDATO_WEBHOOK_SECRET: optional,
    RESEND_API_KEY: optional,
    EMAIL_FROM: optional,
    TELEGRAM_BOT_TOKEN: optional,
    TURNSTILE_SECRET_KEY: optional,
    SENTRY_DSN: optional,
    BETTERSTACK_HEARTBEAT_URL: optional,
  })
  .superRefine((env, ctx) => {
    // §6 "Safety": stand-ins refuse to start in production.
    if (env.APP_ENV !== "production") return;
    const standIns: [keyof typeof env, string][] = [
      ["LOT_PROVIDER", "fixtures"],
      ["KYC_PROVIDER", "fake"],
      ["PAYMENT_PROVIDER", "fake"],
      ["EMAIL_TRANSPORT", "smtp"],
      ["TELEGRAM_TRANSPORT", "log"],
    ];
    for (const [key, standIn] of standIns) {
      if (env[key] === standIn) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: `${key}=${standIn} is not allowed when APP_ENV=production`,
        });
      }
    }
    if (env.BETTER_AUTH_SECRET === DEV_AUTH_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["BETTER_AUTH_SECRET"],
        message: "the development BETTER_AUTH_SECRET is not allowed when APP_ENV=production",
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(
  source: Record<string, string | undefined> = process.env,
): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid server environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
