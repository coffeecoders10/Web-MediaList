"use client";

import { createContext, use, type ReactNode } from "react";
import { WorkspaceProvider } from "@/components/workspace/Workspace";
import { MediaProvider } from "@/lib/media/store";
import type { MediaItem } from "@/lib/media/types";
import type { SessionUser } from "@/lib/session-token";

const UserContext = createContext<SessionUser | null>(null);

export function Providers({ user, initialItems, children }: { user: SessionUser; initialItems: MediaItem[]; children: ReactNode }) {
  return (
    <UserContext value={user}>
      <MediaProvider initialItems={initialItems}>
        <WorkspaceProvider>{children}</WorkspaceProvider>
      </MediaProvider>
    </UserContext>
  );
}

export function useUser(): SessionUser {
  const user = use(UserContext);
  if (!user) throw new Error("useUser must be used inside <Providers>");
  return user;
}
