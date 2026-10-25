"use client";

import { DropdownMenu } from "radix-ui";
import type { ReactNode } from "react";
import app from "@/components/AppHeader.module.css";
import { useProfile } from "./ProfileProviders";

/** Wraps a button: pressing it offers to add the given titles to your list as Planned or as Completed. */
export function AddToListMenu({ keys, label, align = "end", children }: { keys: string[]; label: string; align?: "start" | "end"; children: ReactNode }) {
  const profile = useProfile();
  if (!profile) return null;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{children}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={app.menu} align={align} sideOffset={8}>
          <DropdownMenu.Label className={app.menuLabel}>
            <span>{label} as</span>
          </DropdownMenu.Label>
          <DropdownMenu.Separator className={app.menuSep} />
          <DropdownMenu.Item className={app.menuItem} onSelect={() => void profile.addToList(keys, "planned")}>
            Planned
          </DropdownMenu.Item>
          <DropdownMenu.Item className={app.menuItem} onSelect={() => void profile.addToList(keys, "completed")}>
            Completed
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
