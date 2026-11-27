import "server-only";
import { nextCookies } from "better-auth/next-js";
import { createAuth, type Auth } from "./auth-config";
import { getDb } from "./db";
import { getEnv } from "./env";

// One instance per process, kept on globalThis so dev hot reloads reuse it.
const store = globalThis as unknown as { basAuth?: Auth };

/** Created on first use, like getDb(), so `next build` needs no runtime env. */
export function getAuth(): Auth {
  store.basAuth ??= createAuth({ env: getEnv(), db: getDb().db, plugins: [nextCookies()] });
  return store.basAuth;
}
