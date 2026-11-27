/**
 * Fast path only: no session cookie → straight to sign-in, without rendering the page.
 * The real checks (session validity, role, 2FA) are requireUser / requireStaff in server code.
 */
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();

  const { pathname } = request.nextUrl;
  const target = pathname.startsWith("/admin")
    ? new URL("/admin/sign-in", request.url)
    : new URL(
        `/${pathname.split("/")[1]}/sign-in?next=${encodeURIComponent(pathname)}`,
        request.url,
      );
  return NextResponse.redirect(target);
}

export const config = {
  // /admin pages except the sign-in and 2FA screens, which work before a full session exists.
  matcher: ["/admin", "/admin/((?!sign-in|two-factor).*)", "/:locale(lt|en)/account/:path*"],
};
