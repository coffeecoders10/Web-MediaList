import { Suspense, type ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AppFallback } from "@/components/AppFallback";
import { Providers } from "@/components/Providers";
import { loadLibrary } from "@/lib/server/collection";
import { requireSession } from "@/lib/server/session";

/**
 * The signed-in app. Reading the session and the user's collection happens per request, so it
 * streams in behind the boundary while the fallback holds the page.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AppFallback />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const items = await loadLibrary(session.userId);
  return (
    <Providers user={{ userId: session.userId, username: session.username, fullName: session.fullName }} initialItems={items}>
      <AppHeader />
      <main>{children}</main>
    </Providers>
  );
}
