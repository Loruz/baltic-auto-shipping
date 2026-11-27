/**
 * Better Auth configuration as a factory (plan §3 "Auth", §4.2, §5). No Next.js imports, so the
 * staff CLI script and the tests build the same auth. The app uses `getAuth()` from ./auth.ts.
 */
import type { ServerEnv } from "@bas/config/env";
import { schema, type Db } from "@bas/db";
import { createEmailSender, type EmailMessage, type SendEmail } from "@bas/notifications";
import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, twoFactor } from "better-auth/plugins";
import { ac, roles } from "@/lib/permissions";

export const APP_NAME = "Baltic Auto Shipping";

export interface CreateAuthOptions {
  env: ServerEnv;
  db: Db;
  sendEmail?: SendEmail;
  /** Framework plugins appended last, e.g. nextCookies(). */
  plugins?: BetterAuthPlugin[];
}

export function createAuth({
  env,
  db,
  sendEmail = createEmailSender(env),
  plugins = [],
}: CreateAuthOptions) {
  // Not awaited, so response timing doesn't reveal whether an address exists (Better Auth guidance).
  const deliver = (message: EmailMessage) => {
    sendEmail(message).catch((error: unknown) => console.error("auth email failed", error));
  };

  const google =
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
      : {};

  return betterAuth({
    appName: APP_NAME,
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.BETTER_AUTH_URL],
    database: drizzleAdapter(db, { provider: "pg", schema, transaction: true }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      // §4.2: a verified email is needed to buy a plan, not to sign in.
      requireEmailVerification: false,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) =>
        deliver({
          to: user.email,
          subject: `${APP_NAME}: slaptažodžio keitimas / password reset`,
          text: `Norėdami pakeisti slaptažodį, atidarykite: ${url}\n\nTo reset your password, open: ${url}\n\nJei to neprašėte, ignoruokite šį laišką. / If you didn't ask for this, ignore this email.`,
        }),
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) =>
        deliver({
          to: user.email,
          subject: `${APP_NAME}: patvirtinkite el. paštą / confirm your email`,
          text: `Patvirtinkite el. pašto adresą: ${url}\n\nConfirm your email address: ${url}`,
        }),
    },
    socialProviders: google,
    plugins: [
      admin({ ac, roles, defaultRole: "customer", adminRoles: ["admin"] }),
      twoFactor({ issuer: APP_NAME }),
      ...plugins,
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
