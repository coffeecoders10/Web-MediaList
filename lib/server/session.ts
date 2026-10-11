import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { SESSION_COOKIE, SESSION_DAYS, signSession, verifySession, type SessionUser } from "@/lib/session-token";

/** The signed-in user, or null. Memoized per request. Reads cookies, so call it behind <Suspense>. */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
});

/** For pages and layouts: sends signed-out visitors to the login page. */
export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function startSession(user: SessionUser): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, await signSession(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // An explicit lifetime makes this a persistent cookie, so it survives closing the browser.
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
