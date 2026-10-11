import { jwtVerify, SignJWT } from "jose";

/**
 * Signed session tokens. Shared by the proxy (an optimistic check on every navigation) and the
 * server-only session helpers, so it has no `server-only` import and touches no cookies.
 *
 * Backbone's login only verifies credentials, so the session is ours: a stateless, signed JWT in an
 * httpOnly cookie. It holds just what the app needs on every request.
 */

export const SESSION_COOKIE = "lightbox_session";
export const SESSION_DAYS = 30;

export interface SessionUser {
  /** Backbone `user_id` (UUID). The only key per-user data is stored under. */
  userId: string;
  username: string;
  fullName: string;
}

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be set to at least 32 characters (see .env.example).");
  return new TextEncoder().encode(secret);
}

export function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ username: user.username, fullName: user.fullName })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.username !== "string") return null;
    return { userId: payload.sub, username: payload.username, fullName: String(payload.fullName ?? "") };
  } catch {
    return null;
  }
}
