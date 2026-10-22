import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { AppFallback } from "@/components/AppFallback";
import { BuiltBy } from "@/components/BuiltBy";
import credit from "@/components/BuiltBy.module.css";
import { Wordmark } from "@/components/Wordmark";
import app from "@/components/AppHeader.module.css";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileProviders } from "@/components/profile/ProfileProviders";
import { buttonClass } from "@/components/ui/Button";
import type { MediaItem } from "@/lib/media/types";
import { findProfile } from "@/lib/server/directory";
import { loadFriends } from "@/lib/server/friends";
import { loadPublicLibrary, loadViewerLibrary } from "@/lib/server/profiles";
import { getSession } from "@/lib/server/session";
import styles from "@/components/profile/ProfilePage.module.css";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const profile = await findProfile((await params).username);
  return { title: profile ? `${profile.fullName || `@${profile.username}`}'s archive` : "No archive here" };
}

/**
 * Someone else's archive. Anyone with the link can look, so the session is optional here: it only
 * decides what the viewer can do (compare, add friends, add titles to their own list).
 */
export default function ProfileLayout({ children, params }: { children: ReactNode; params: Promise<{ username: string }> }) {
  return (
    <Suspense fallback={<AppFallback />}>
      <Shell params={params}>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children, params }: { children: ReactNode; params: Promise<{ username: string }> }) {
  const { username } = await params;
  const [session, profile] = await Promise.all([getSession(), findProfile(username)]);

  if (!profile) return <Missing username={username} signedIn={session !== null} />;
  if (session?.userId === profile.userId) redirect("/"); // your own profile is just your library

  const [items, mine, friends] = await Promise.all([
    loadPublicLibrary(profile.userId),
    session ? loadViewerLibrary(session.userId) : Promise.resolve<MediaItem[]>([]),
    session ? loadFriends(session.userId) : Promise.resolve<string[]>([]),
  ]);

  const owner = { username: profile.username, fullName: profile.fullName };
  const viewer = session ? { username: session.username, fullName: session.fullName } : null;

  return (
    <ProfileProviders
      owner={owner}
      viewer={viewer}
      items={items}
      viewerKeys={mine.map((i) => i.id)}
      isFriend={friends.includes(profile.username.toLowerCase())}
    >
      <ProfileHeader owner={owner} viewer={viewer} />
      <main>{children}</main>
      <footer className={credit.footer}>
        <BuiltBy />
      </footer>
    </ProfileProviders>
  );
}

function Missing({ username, signedIn }: { username: string; signedIn: boolean }) {
  return (
    <>
      <header className={app.header}>
        <div className={`shell ${app.bar}`}>
          <Wordmark />
        </div>
      </header>
      <main>
        <div className={`shell ${styles.missing}`}>
          <h1>No archive at @{username}</h1>
          <p>
            That username doesn&apos;t exist, or they haven&apos;t signed in since profiles were added. Check the link with the person who
            sent it.
          </p>
          <Link href="/" className={buttonClass({ variant: "outline" })}>
            {signedIn ? "Back to my library" : "Go to The Archive"}
          </Link>
        </div>
      </main>
    </>
  );
}
