"use client";

import { CopyIcon, Cross2Icon, EyeOpenIcon, PlusIcon } from "@radix-ui/react-icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useSyncExternalStore, useTransition, type FormEvent } from "react";
import { addFriendByUsername, removeFriendByUsername, type FriendSummary } from "@/app/actions/friends";
import { useUser } from "@/components/Providers";
import { Avatar } from "@/components/profile/Avatar";
import { Button, buttonClass } from "@/components/ui/Button";
import { Field, describedBy, inputClass } from "@/components/ui/Field";
import { useWorkspace } from "@/components/workspace/Workspace";
import { profileUrl } from "@/lib/media/share";
import styles from "./FriendsView.module.css";

const noopSubscribe = () => () => {};
/** The profile link needs the page's origin, which the server doesn't know; it fills in once hydrated. */
const useShareUrl = (username: string) => useSyncExternalStore(noopSubscribe, () => profileUrl(username), () => `/u/${username}`);

export function FriendsView({ friends }: { friends: FriendSummary[] }) {
  const user = useUser();
  const router = useRouter();
  const { notify } = useWorkspace();
  const inputId = useId();
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const shareUrl = useShareUrl(user.username);

  const add = (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await addFriendByUsername(name);
      if (!result.ok) return setError(result.error);
      setName("");
      notify(result.added ? `Added @${result.friend.username}` : `@${result.friend.username} is already in your friends`);
      router.refresh();
    });
  };

  const remove = (friend: FriendSummary) => {
    startTransition(async () => {
      const result = await removeFriendByUsername(friend.username);
      if (!result.ok) return notify(result.error);
      notify(`Removed @${friend.username}`, {
        label: "Undo",
        run: () => void addFriendByUsername(friend.username).then(() => router.refresh()),
      });
      router.refresh();
    });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      notify("Profile link copied");
    } catch {
      notify("Couldn't copy the link");
    }
  };

  return (
    <div className={`shell ${styles.page}`}>
      <h1 className={styles.heading}>Friends</h1>

      <div className={styles.layout}>
        <section className={styles.side} aria-labelledby="add-heading">
          <h2 id="add-heading" className={styles.subhead}>
            Add a friend
          </h2>
          <form className={styles.form} onSubmit={add} noValidate>
            <Field label="Their username" htmlFor={inputId} error={error} hint="The one they signed up with, with or without the @.">
              <input
                id={inputId}
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy(inputId, { error, hint: "hint" })}
              />
            </Field>
            <Button type="submit" variant="solid" disabled={pending || name.trim() === ""}>
              <PlusIcon aria-hidden="true" />
              {pending ? "Adding…" : "Add friend"}
            </Button>
          </form>

          <div className={styles.share}>
            <h2 className={styles.subhead}>Share your profile</h2>
            <p className={styles.muted}>Anyone with this link can see your library and stats. They can&apos;t change anything.</p>
            <div className={styles.link}>
              <output>{shareUrl}</output>
              <Button variant="outline" size="sm" onClick={() => void copy()}>
                <CopyIcon aria-hidden="true" />
                Copy link
              </Button>
            </div>
          </div>
        </section>

        <section aria-labelledby="list-heading" className={styles.list}>
          <h2 id="list-heading" className={styles.subhead}>
            {friends.length === 0 ? "No friends yet" : `${friends.length} ${friends.length === 1 ? "friend" : "friends"}`}
          </h2>
          {friends.length === 0 ? (
            <p className={styles.muted}>Add someone by username, or send them your link and ask for theirs.</p>
          ) : (
            <ul className={styles.people}>
              {friends.map((friend) => (
                <li key={friend.username} className={styles.person}>
                  <Avatar person={friend} size="md" />
                  <Link href={`/u/${friend.username}`} className={styles.names}>
                    <strong>{friend.fullName || `@${friend.username}`}</strong>
                    {friend.fullName && <span>@{friend.username}</span>}
                  </Link>
                  <div className={styles.buttons}>
                    <Link
                      href={`/u/${friend.username}`}
                      className={buttonClass({ variant: "outline", size: "sm" })}
                      aria-label={`View @${friend.username}'s profile`}
                    >
                      <EyeOpenIcon aria-hidden="true" />
                      <span className={styles.label}>View</span>
                    </Link>
                    <Button variant="quiet" size="sm" disabled={pending} onClick={() => remove(friend)} aria-label={`Remove @${friend.username} from friends`}>
                      <Cross2Icon aria-hidden="true" />
                      <span className={styles.label}>Remove friend</span>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
