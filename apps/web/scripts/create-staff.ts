/**
 * Creates a staff login (plan §5) with a one-time temporary password.
 *   pnpm --filter @bas/web auth:create-staff --email name@example.com --role admin [--name "Full Name"]
 * The person signs in at /admin/sign-in and must set up TOTP 2FA before the console opens.
 */
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { parseServerEnv } from "@bas/config/env";
import { createDb } from "@bas/db";
import { STAFF_ROLES } from "@/lib/permissions";
import { createAuth } from "@/server/auth-config";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    role: { type: "string" },
    name: { type: "string" },
  },
});

const { email, role } = values;
if (!email || !role || !(STAFF_ROLES as readonly string[]).includes(role)) {
  console.error(
    `Usage: auth:create-staff --email <email> --role <${STAFF_ROLES.join("|")}> [--name <name>]`,
  );
  process.exit(1);
}

const env = parseServerEnv();
const { db, client } = createDb(env.DATABASE_URL, { max: 1 });
const auth = createAuth({ env, db });
const password = randomBytes(18).toString("base64url");

try {
  const { user } = await auth.api.createUser({
    body: {
      email,
      password,
      name: values.name ?? email,
      role: role as (typeof STAFF_ROLES)[number],
      data: { emailVerified: true },
    },
  });
  console.log(`Created ${user.role} ${user.email}`);
  console.log(`Temporary password (shown once): ${password}`);
  console.log("Sign in at /admin/sign-in; two-factor setup is required on first sign-in.");
} finally {
  await client.end();
}
