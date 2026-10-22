import type { Metadata } from "next";
import { FriendsView } from "@/components/friends/FriendsView";
import { findProfile } from "@/lib/server/directory";
import { loadFriends } from "@/lib/server/friends";
import { requireSession } from "@/lib/server/session";

export const metadata: Metadata = { title: "Friends" };

export default async function FriendsPage() {
  const session = await requireSession();
  const usernames = await loadFriends(session.userId);
  const found = await Promise.all(usernames.map((u) => findProfile(u)));
  // A friend whose profile can no longer be found is kept in the list under their username, so it can still be removed.
  const friends = usernames.map((username, i) => ({ username, fullName: found[i]?.fullName ?? "" }));
  return <FriendsView friends={friends} />;
}
