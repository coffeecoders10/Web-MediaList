"use client";

import { ArrowLeftIcon, Cross2Icon, ExitIcon, HamburgerMenuIcon, Link2Icon, MixerHorizontalIcon, PersonIcon, PlusIcon, ReaderIcon } from "@radix-ui/react-icons";
import { DropdownMenu } from "radix-ui";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { logout } from "@/app/actions/auth";
import { Wordmark } from "@/components/Wordmark";
import { Button, buttonClass } from "@/components/ui/Button";
import { useWorkspace } from "@/components/workspace/Workspace";
import { profileUrl } from "@/lib/media/share";
import { Avatar } from "./Avatar";
import { displayName, type Person, useProfile } from "./ProfileProviders";
import app from "@/components/AppHeader.module.css";
import styles from "./ProfileHeader.module.css";

/**
 * Everything on a profile page sits under this header. The top bar is the app's own, with a back arrow
 * in place of a Home tab and the same account menu. The band below is the profile itself: who, what you
 * can do, and where to go.
 */
export function ProfileHeader({ owner, viewer }: { owner: Person; viewer: Person | null }) {
  const pathname = usePathname();
  const base = `/u/${owner.username}`;
  const tabs = [
    { href: base, label: "Library", active: pathname === base || pathname.startsWith(`${base}/media`) },
    { href: `${base}/stats`, label: "Stats", active: pathname.startsWith(`${base}/stats`) },
  ];

  return (
    <>
      <header className={app.header} data-viewing="">
        <div className={`shell ${app.bar}`}>
          <BackButton />
          <Wordmark />

          <div className={app.tools}>
            {viewer ? (
              <AccountMenu viewer={viewer} />
            ) : (
              <>
                <Link href="/login" className={buttonClass({ variant: "quiet", size: "sm" })}>
                  Sign in
                </Link>
                <Link href="/signup" className={buttonClass({ variant: "solid", size: "sm" })}>
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <div className={styles.band}>
        <div className={`shell ${styles.bandInner}`}>
          <div className={styles.who}>
            <Avatar person={owner} size="lg" />
            <div className={styles.names}>
              <p className={styles.name}>{owner.fullName || `@${owner.username}`}</p>
              <p className={styles.handle}>
                {owner.fullName && <>@{owner.username}</>}
              </p>
            </div>
          </div>

          <nav className={styles.tabs} aria-label={`${displayName(owner)}'s archive`}>
            {tabs.map(({ href, label, active }) => (
              <Link key={href} href={href} className={app.navLink} aria-current={active ? "page" : undefined}>
                {label}
              </Link>
            ))}
          </nav>

          <Actions owner={owner} viewer={viewer} />
        </div>
      </div>
    </>
  );
}

function BackButton() {
  const router = useRouter();
  return (
    <Button
      variant="quiet"
      size="sm"
      icon
      aria-label="Back"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
    >
      <ArrowLeftIcon />
    </Button>
  );
}

function Actions({ owner, viewer }: { owner: Person; viewer: Person | null }) {
  const profile = useProfile();
  const { notify } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const base = `/u/${owner.username}`;
  const friendLabel = profile?.isFriend ? "Remove friend" : "Add friend";

  const toggleFriend = async () => {
    if (!profile) return;
    setBusy(true);
    await profile.setFriend(!profile.isFriend);
    setBusy(false);
  };

  return (
    <div className={styles.actions}>
      {viewer ? (
        <>
          <Link href={`${base}/compare`} className={buttonClass({ variant: "solid", size: "sm" })} aria-label="Compare libraries">
            <MixerHorizontalIcon aria-hidden="true" />
            <span className={styles.label}>Compare</span>
          </Link>
          <Button variant="outline" size="sm" onClick={() => void toggleFriend()} disabled={busy} aria-label={friendLabel}>
            {profile?.isFriend ? <Cross2Icon aria-hidden="true" /> : <PlusIcon aria-hidden="true" />}
            <span className={styles.label}>{friendLabel}</span>
          </Button>
        </>
      ) : (
        <Link href="/login" className={buttonClass({ variant: "solid", size: "sm" })}>
          <MixerHorizontalIcon aria-hidden="true" />
          Sign in to compare
        </Link>
      )}
    </div>
  );
}

function AccountMenu({ viewer }: { viewer: Person }) {
  const { notify } = useWorkspace();
  const copyProfileLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl(viewer.username));
      notify("Profile link copied. Anyone with it can view your library and stats.");
    } catch {
      notify("Couldn't copy the link");
    }
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="quiet" size="sm" icon aria-label="Menu">
          <HamburgerMenuIcon />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={app.menu} align="end" sideOffset={8}>
          <DropdownMenu.Label className={app.menuLabel}>
            <strong>{viewer.fullName || viewer.username}</strong>
            <span>@{viewer.username}</span>
          </DropdownMenu.Label>
          <DropdownMenu.Separator className={app.menuSep} />
          <DropdownMenu.Item asChild className={app.menuItem}>
            <Link href="/">
              <ReaderIcon /> My library
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={app.menuItem}>
            <Link href="/friends">
              <PersonIcon /> Friends
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item className={app.menuItem} onSelect={() => void copyProfileLink()}>
            <Link2Icon /> Copy my profile link
          </DropdownMenu.Item>
          <DropdownMenu.Separator className={app.menuSep} />
          <DropdownMenu.Item className={app.menuItem} onSelect={() => void logout()}>
            <ExitIcon /> Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
