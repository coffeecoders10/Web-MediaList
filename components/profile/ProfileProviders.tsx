"use client";

import { createContext, use, useCallback, useMemo, useState, type ReactNode } from "react";
import { addFriendByUsername, removeFriendByUsername } from "@/app/actions/friends";
import { addToMyList } from "@/app/actions/library";
import { useWorkspace, WorkspaceProvider } from "@/components/workspace/Workspace";
import { ReadOnlyMediaProvider } from "@/lib/media/store";
import type { MediaItem } from "@/lib/media/types";

export interface Person {
  username: string;
  fullName: string;
}

interface ProfileContextValue {
  /** Whose collection this is. */
  owner: Person;
  /** Where their pages live, e.g. `/u/jane`. */
  base: string;
  /** The signed-in person looking at it; null for a visitor with just the link. */
  viewer: Person | null;
  isFriend: boolean;
  setFriend: (on: boolean) => Promise<void>;
  /** Collection keys the viewer already has. */
  owned: ReadonlySet<string>;
  /** Adds titles from this profile to the viewer's list as Planned. */
  addToList: (keys: string[]) => Promise<boolean>;
}

/** Null everywhere outside someone else's profile, which is how shared components know to go read-only. */
const ProfileContext = createContext<ProfileContextValue | null>(null);

export const useProfile = () => use(ProfileContext);

/** Where links to the library, stats and titles point: the viewer's own pages, or the profile being visited. */
export function useLinks() {
  const base = use(ProfileContext)?.base;
  return useMemo(
    () => ({
      library: base ?? "/",
      stats: `${base ?? ""}/stats`,
      media: (id: string) => `${base ?? ""}/media/${id}`,
      genre: (name: string) => `${base ?? ""}/?genre=${encodeURIComponent(name)}`,
    }),
    [base],
  );
}

export const displayName = (person: Person) => person.fullName || `@${person.username}`;

interface Props {
  owner: Person;
  viewer: Person | null;
  items: MediaItem[];
  viewerKeys: string[];
  isFriend: boolean;
  children: ReactNode;
}

export function ProfileProviders({ items, children, ...rest }: Props) {
  return (
    <ReadOnlyMediaProvider items={items}>
      <WorkspaceProvider readOnly>
        <ProfileState {...rest}>{children}</ProfileState>
      </WorkspaceProvider>
    </ReadOnlyMediaProvider>
  );
}

function ProfileState({ owner, viewer, viewerKeys, isFriend: initialFriend, children }: Omit<Props, "items">) {
  const { notify } = useWorkspace();
  const [isFriend, setIsFriend] = useState(initialFriend);
  const [owned, setOwned] = useState<ReadonlySet<string>>(() => new Set(viewerKeys));

  const setFriend = useCallback(
    async (on: boolean) => {
      const result = on ? await addFriendByUsername(owner.username) : await removeFriendByUsername(owner.username);
      if (result.ok) {
        setIsFriend(on);
        notify(on ? `${displayName(owner)} is now in your friends` : `Removed ${displayName(owner)} from your friends`);
      } else {
        notify(result.error);
      }
    },
    [owner, notify],
  );

  const addToList = useCallback(
    async (keys: string[]) => {
      const result = await addToMyList(keys);
      if (!result.ok) {
        notify(result.error);
        return false;
      }
      setOwned((prev) => new Set([...prev, ...keys]));
      const added = result.items.length;
      notify(
        added > 0
          ? `Added ${added} ${added === 1 ? "title" : "titles"} to your list as Planned`
          : "Those titles are already in your list",
      );
      return true;
    },
    [notify],
  );

  const value = useMemo<ProfileContextValue>(
    () => ({ owner, base: `/u/${owner.username}`, viewer, isFriend, setFriend, owned, addToList }),
    [owner, viewer, isFriend, setFriend, owned, addToList],
  );

  return <ProfileContext value={value}>{children}</ProfileContext>;
}
