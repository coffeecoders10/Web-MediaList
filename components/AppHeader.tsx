"use client";

import { ArchiveIcon, CopyIcon, DownloadIcon, ExitIcon, HamburgerMenuIcon, Link2Icon, Pencil1Icon, PersonIcon, ReaderIcon } from "@radix-ui/react-icons";
import { AlertDialog, DropdownMenu, Switch } from "radix-ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logout } from "@/app/actions/auth";
import { useUser } from "@/components/Providers";
import { Button } from "@/components/ui/Button";
import { Wordmark } from "@/components/Wordmark";
import { useWorkspace } from "@/components/workspace/Workspace";
import { dismissLegacyOffer, markLegacyImported, readLegacyItems, useLegacy } from "@/lib/media/legacy";
import { profileUrl } from "@/lib/media/share";
import { useMedia } from "@/lib/media/store";
import styles from "./AppHeader.module.css";
import dialog from "@/components/workspace/Workspace.module.css";

const NAV = [
  { href: "/", label: "Library" },
  { href: "/stats", label: "Stats" },
];

const summarize = (added: number, skipped: number) =>
  `Imported ${added} ${added === 1 ? "title" : "titles"}${skipped ? `, ${skipped} already in your collection` : ""}`;

export function AppHeader() {
  const pathname = usePathname();
  const { editMode, setEditMode, notify } = useWorkspace();
  const { exportJson, add } = useMedia();
  const user = useUser();
  const legacy = useLegacy(user.userId);
  const [offerOpen, setOfferOpen] = useState(true);
  const [importing, setImporting] = useState(false);

  const download = () => {
    const url = URL.createObjectURL(new Blob([exportJson()], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `the-archive-collection-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify("Collection exported");
  };

  const copyUserId = async () => {
    try {
      await navigator.clipboard.writeText(user.userId);
      notify("User ID copied");
    } catch {
      notify("Couldn't copy the user ID");
    }
  };

  const copyProfileLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl(user.username));
      notify("Profile link copied. Anyone with it can view your library and stats.");
    } catch {
      notify("Couldn't copy the link");
    }
  };

  const importFromBrowser = async () => {
    setImporting(true);
    const result = await add(readLegacyItems().map((item) => ({ item })));
    setImporting(false);
    if (!result.ok) return notify(result.error);
    markLegacyImported(user.userId);
    setOfferOpen(false);
    notify(summarize(result.items.length, result.skipped));
  };

  return (
    <header className={styles.header} data-editing={editMode || undefined}>
      <div className={`shell ${styles.bar}`}>
        <Wordmark />

        <nav className={styles.nav} aria-label="Main">
          {NAV.map(({ href, label }) => {
            const active = href === "/" ? pathname === "/" || pathname.startsWith("/media") : pathname.startsWith(href);
            return (
              <Link key={href} href={href} className={styles.navLink} aria-current={active ? "page" : undefined}>
                {label}
              </Link>
            );
          })}
        </nav>

        <div className={styles.tools}>
          <label className={styles.switch}>
            <Pencil1Icon className={styles.switchIcon} aria-hidden="true" />
            <span>Edit</span>
            <Switch.Root className={styles.switchRoot} aria-label="Edit mode" checked={editMode} onCheckedChange={setEditMode}>
              <Switch.Thumb className={styles.switchThumb} />
            </Switch.Root>
          </label>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button variant="quiet" size="sm" icon aria-label="Menu">
                <HamburgerMenuIcon />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className={styles.menu} align="end" sideOffset={8}>
                <DropdownMenu.Label className={styles.menuLabel}>
                  <strong>{user.fullName || user.username}</strong>
                  <span>@{user.username}</span>
                </DropdownMenu.Label>
                {editMode && (
                  <DropdownMenu.Item className={styles.menuItem} onSelect={() => void copyUserId()}>
                    <CopyIcon /> Copy user ID
                  </DropdownMenu.Item>
                )}
                <DropdownMenu.Separator className={styles.menuSep} />
                <DropdownMenu.Item asChild className={styles.menuItem}>
                  <Link href="/">
                    <ReaderIcon /> My library
                  </Link>
                </DropdownMenu.Item>
                <DropdownMenu.Item asChild className={styles.menuItem}>
                  <Link href="/friends">
                    <PersonIcon /> Friends
                  </Link>
                </DropdownMenu.Item>
                <DropdownMenu.Item className={styles.menuItem} onSelect={() => void copyProfileLink()}>
                  <Link2Icon /> Copy my profile link
                </DropdownMenu.Item>
                <DropdownMenu.Separator className={styles.menuSep} />
                {legacy.count > 0 && (
                  <DropdownMenu.Item className={styles.menuItem} disabled={importing} onSelect={() => void importFromBrowser()}>
                    <ArchiveIcon /> Import {legacy.count} saved in this browser
                  </DropdownMenu.Item>
                )}
                <DropdownMenu.Item className={styles.menuItem} onSelect={download}>
                  <DownloadIcon /> Export as JSON
                </DropdownMenu.Item>
                <DropdownMenu.Separator className={styles.menuSep} />
                <DropdownMenu.Item className={styles.menuItem} onSelect={() => void logout()}>
                  <ExitIcon /> Sign out
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      <AlertDialog.Root open={legacy.count > 0 && !legacy.dismissed && offerOpen} onOpenChange={setOfferOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className={dialog.overlay} />
          <AlertDialog.Content className={dialog.alert}>
            <AlertDialog.Title className={dialog.alertTitle}>
              Bring {legacy.count} {legacy.count === 1 ? "title" : "titles"} into your account?
            </AlertDialog.Title>
            <AlertDialog.Description className={dialog.alertBody}>
              This browser has a collection saved from before accounts. Importing adds it to your account so it follows you to other
              devices. The copy in this browser is kept.
            </AlertDialog.Description>
            <div className={dialog.alertActions}>
              <AlertDialog.Cancel asChild>
                <Button variant="outline" onClick={() => dismissLegacyOffer(user.userId)}>
                  Not now
                </Button>
              </AlertDialog.Cancel>
              <Button variant="solid" disabled={importing} onClick={() => void importFromBrowser()}>
                {importing ? "Importing…" : "Import"}
              </Button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </header>
  );
}
