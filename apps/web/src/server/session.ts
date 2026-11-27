import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { staffAccess } from "./access";
import { getAuth } from "./auth";

/**
 * The current session, read once per request. `headers()` comes first: it marks the page as
 * request-time, so `next build` never reaches getAuth() (which needs the runtime env).
 */
export const getSession = cache(async () => {
  const requestHeaders = await headers();
  return getAuth().api.getSession({ headers: requestHeaders });
});

export type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;

/** Any signed-in user; otherwise to the locale's sign-in page, coming back to `next`. */
export async function requireUser(locale: string, next: string): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(`/${locale}/sign-in?next=${encodeURIComponent(next)}`);
  return session;
}

/** Staff with 2FA set up (plan §5). Customers get a 404, so /admin doesn't advertise itself. */
export async function requireStaff(): Promise<Session> {
  const session = await getSession();
  const access = staffAccess(session?.user);
  if (access === "sign-in" || !session) redirect("/admin/sign-in");
  if (access === "forbidden") notFound();
  if (access === "setup-2fa") redirect("/admin/two-factor/setup");
  return session;
}
