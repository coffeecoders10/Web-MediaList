import "server-only";
import { readOrCreate, serial } from "./documents";
import { userMedia } from "./backbone";

/**
 * A user's friends: a `user_media` document (`friends_<user_id>`) listing usernames. Friending is
 * one-way and needs no approval, because a profile is already viewable by anyone with its link.
 */

interface FriendsDoc extends Record<string, unknown> {
  v: 1;
  usernames: string[];
}

const docId = (userId: string) => `friends_${userId}`;

async function read(userId: string): Promise<FriendsDoc> {
  const doc = await readOrCreate<FriendsDoc>(docId(userId), { v: 1, usernames: [] });
  const usernames = Array.isArray(doc.usernames) ? doc.usernames.filter((u): u is string => typeof u === "string") : [];
  return { v: 1, usernames };
}

export async function loadFriends(userId: string): Promise<string[]> {
  return (await read(userId)).usernames;
}

/** Returns false when they were already a friend. */
export async function addFriend(userId: string, username: string): Promise<boolean> {
  const name = username.toLowerCase();
  return serial(docId(userId), async () => {
    const doc = await read(userId);
    if (doc.usernames.includes(name)) return false;
    await userMedia.write(docId(userId), { ...doc, usernames: [...doc.usernames, name] });
    return true;
  });
}

export async function removeFriend(userId: string, username: string): Promise<void> {
  const name = username.toLowerCase();
  await serial(docId(userId), async () => {
    const doc = await read(userId);
    if (!doc.usernames.includes(name)) return;
    await userMedia.write(docId(userId), { ...doc, usernames: doc.usernames.filter((u) => u !== name) });
  });
}
