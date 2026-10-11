import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session-token";

/**
 * Optimistic gate only: it spares signed-out visitors a round trip through the app and keeps signed-in
 * users out of the login forms. The real checks happen next to the data (see lib/server/session.ts).
 */
const PUBLIC = ["/login", "/signup"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const signedIn = (await verifySession(request.cookies.get(SESSION_COOKIE)?.value)) !== null;
  const isPublic = PUBLIC.includes(pathname);

  if (!signedIn && !isPublic) return NextResponse.redirect(new URL("/login", request.url));
  if (signedIn && isPublic) return NextResponse.redirect(new URL("/", request.url));
  return NextResponse.next();
}

export const config = {
  // Everything except static assets and Next internals.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
