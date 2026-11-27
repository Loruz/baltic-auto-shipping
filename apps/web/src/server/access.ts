/**
 * Access decisions as pure functions, so they are unit-tested without a request.
 * The guards in ./session.ts turn them into redirects.
 */
import { isStaffRole } from "@/lib/permissions";

export interface SessionUserLike {
  role?: string | null;
  twoFactorEnabled?: boolean | null;
}

export type StaffAccess = "allow" | "sign-in" | "forbidden" | "setup-2fa";

/** Plan §5: /admin needs a staff role and TOTP 2FA. */
export function staffAccess(user: SessionUserLike | null | undefined): StaffAccess {
  if (!user) return "sign-in";
  if (!isStaffRole(user.role)) return "forbidden";
  if (!user.twoFactorEnabled) return "setup-2fa";
  return "allow";
}

/** Only same-site relative paths are accepted as `next`, so sign-in can't redirect off-site. */
export function safeNextPath(next: string | null | undefined, fallback: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\"))
    return fallback;
  return next;
}
