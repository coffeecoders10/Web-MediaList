import "server-only";
import { cache } from "react";
import type { SessionUser } from "@/lib/session-token";
import { userMedia } from "./backbone";

/**
 * Backbone can't look a user up by username, so profiles are found through a small directory: one
 * `user_media` document per username (`handle_jane`) pointing at the user's `user_id`. It is written
 * only for the verified, signed-in user, and holds nothing beyond what a profile page shows.
 */

export interface PublicProfile {
  userId: string;
  username: string;
  fullName: string;
}

interface HandleDoc extends Record<string, unknown> {
  v: 1;
  userId: string;
  username: string;
  fullName: string;
}

const USERNAME = /^\w{3,30}$/;
export const isUsername = (value: unknown): value is string => typeof value === "string" && USERNAME.test(value);

const handleId = (username: string) => `handle_${username.toLowerCase()}`;

/** Usernames already written by this server instance, so the app doesn't re-check on every page. */
const registered = new Set<string>();

/** Makes the user findable by username. Safe to call repeatedly: it writes only when something changed. */
export async function registerHandle(user: SessionUser): Promise<void> {
  const username = user.username.toLowerCase();
  const key = `${user.userId}:${username}:${user.fullName}`;
  if (registered.has(key)) return;

  const id = handleId(username);
  const existing = await userMedia.read<Partial<HandleDoc>>(id);
  if (existing?.userId === user.userId && existing.fullName === user.fullName) {
    registered.add(key);
    return;
  }
  if (!existing) await userMedia.create(id); // false just means another request got there first
  await userMedia.write(id, { v: 1, userId: user.userId, username, fullName: user.fullName } satisfies HandleDoc);
  registered.add(key);
}

/** Null when no one goes by that username (or they haven't signed in since profiles existed). */
export const findProfile = cache(async (username: string): Promise<PublicProfile | null> => {
  if (!isUsername(username)) return null;
  const doc = await userMedia.read<Partial<HandleDoc>>(handleId(username));
  if (!doc || typeof doc.userId !== "string" || typeof doc.username !== "string") return null;
  return { userId: doc.userId, username: doc.username, fullName: typeof doc.fullName === "string" ? doc.fullName : "" };
});
