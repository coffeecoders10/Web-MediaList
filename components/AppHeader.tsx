"use client";

import { DotsHorizontalIcon, DownloadIcon, PlusIcon, ResetIcon, UploadIcon } from "@radix-ui/react-icons";
import { AlertDialog, DropdownMenu, Switch } from "radix-ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useWorkspace } from "@/components/workspace/Workspace";
import { useMedia } from "@/lib/media/store";
import styles from "./AppHeader.module.css";
import dialog from "@/components/workspace/Workspace.module.css";

const NAV = [
  { href: "/", label: "Library" },
  { href: "/genres", label: "Genres" },
  { href: "/stats", label: "Stats" },
];

function Wordmark() {
  return (
    <Link href="/" className={styles.wordmark} aria-label="Lightbox, home">
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        <rect x="1" y="1" width="20" height="20" rx="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <rect x="6" y="6" width="10" height="10" rx="2" fill="var(--lit)" />
      </svg>
      <span>Lightbox</span>
    </Link>
  );
}

export function AppHeader() {
  const pathname = usePathname();
  const { editMode, setEditMode, openEditor, notify } = useWorkspace();
  const { exportJson, importJson, resetToSample } = useMedia();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const download = () => {
    const url = URL.createObjectURL(new Blob([exportJson()], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `lightbox-collection-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify("Collection exported");
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const count = await importJson(await file.text());
    notify(count ? `Imported ${count} ${count === 1 ? "title" : "titles"}` : "That file has no usable titles. Nothing was changed.");
    if (fileRef.current) fileRef.current.value = "";
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
          {editMode && (
            <Button variant="solid" size="sm" onClick={() => openEditor({ mode: "new" })}>
              <PlusIcon aria-hidden="true" />
              Add title
            </Button>
          )}

          <label className={styles.switch}>
            <span>Edit</span>
            <Switch.Root className={styles.switchRoot} aria-label="Edit mode" checked={editMode} onCheckedChange={setEditMode}>
              <Switch.Thumb className={styles.switchThumb} />
            </Switch.Root>
          </label>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button variant="quiet" size="sm" icon aria-label="Collection data">
                <DotsHorizontalIcon />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className={styles.menu} align="end" sideOffset={8}>
                <DropdownMenu.Item className={styles.menuItem} onSelect={download}>
                  <DownloadIcon /> Export as JSON
                </DropdownMenu.Item>
                <DropdownMenu.Item className={styles.menuItem} onSelect={() => fileRef.current?.click()}>
                  <UploadIcon /> Import from JSON
                </DropdownMenu.Item>
                <DropdownMenu.Separator className={styles.menuSep} />
                <DropdownMenu.Item className={styles.menuItem} onSelect={() => setConfirmReset(true)}>
                  <ResetIcon /> Restore sample collection
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </div>
      </div>

      <AlertDialog.Root open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className={dialog.overlay} />
          <AlertDialog.Content className={dialog.alert}>
            <AlertDialog.Title className={dialog.alertTitle}>Restore the sample collection?</AlertDialog.Title>
            <AlertDialog.Description className={dialog.alertBody}>
              Every title you added or changed will be replaced by the original sample data. Export first if you want a copy.
            </AlertDialog.Description>
            <div className={dialog.alertActions}>
              <AlertDialog.Cancel asChild>
                <Button variant="outline">Cancel</Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button
                  variant="danger"
                  onClick={() => {
                    resetToSample();
                    notify("Sample collection restored");
                  }}
                >
                  Restore sample
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </header>
  );
}
