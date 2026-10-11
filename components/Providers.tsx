"use client";

import type { ReactNode } from "react";
import { WorkspaceProvider } from "@/components/workspace/Workspace";
import { MediaProvider } from "@/lib/media/store";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <MediaProvider>
      <WorkspaceProvider>{children}</WorkspaceProvider>
    </MediaProvider>
  );
}
