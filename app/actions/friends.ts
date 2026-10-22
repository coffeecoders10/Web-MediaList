"use server";

import type { ActionResult } from "@/lib/media/api";
import { findProfile, isUsername } from "@/lib/server/directory";
import { addFriend, removeFriend } from "@/lib/server/friends";
import { requireSession } from "@/lib/server/session";
import { isThrottled, recordAttempt } from "@/lib/server/throttle";

/** Same rule as the other actions: the user comes from the session, the username is untrusted input. */

export interface FriendSummary {
  username: string;
  fullName: string;
}

export async function addFriendByUsername(raw: unknown): Promise<ActionResult<{ friend: FriendSummary; added: boolean }>> {
  const session = await requireSession();
  const username = typeof raw === "string" ? raw.trim().replace(/^@/, "") : "";
  if (!isUsername(username)) return { ok: false, error: "Usernames are 3 to 30 letters, numbers or underscores." };
  if (username.toLowerCase() === session.username.toLowerCase()) return { ok: false, error: "That's you. Add someone else." };

  // Lookups reveal which usernames exist, so misses are metered.
  const meter = `friend-lookup:${session.userId}`;
  if (isThrottled(meter, 20)) return { ok: false, error: "Too many lookups. Wait a few minutes and try again." };

  try {
    const profile = await findProfile(username);
    if (!profile) {
      recordAttempt(meter);
      return { ok: false, error: `No one goes by @${username.toLowerCase()}. Check the spelling, and that they've signed in recently.` };
    }
    const added = await addFriend(session.userId, profile.username);
    return { ok: true, added, friend: { username: profile.username, fullName: profile.fullName } };
  } catch (error) {
    console.error("[friends]", error);
    return { ok: false, error: "Couldn't reach the friends list. Try again in a moment." };
  }
}

export async function removeFriendByUsername(raw: unknown): Promise<ActionResult> {
  const session = await requireSession();
  if (!isUsername(raw)) return { ok: false, error: "That username isn't valid." };
  try {
    await removeFriend(session.userId, raw);
    return { ok: true };
  } catch (error) {
    console.error("[friends]", error);
    return { ok: false, error: "Couldn't update your friends. Try again in a moment." };
  }
}
