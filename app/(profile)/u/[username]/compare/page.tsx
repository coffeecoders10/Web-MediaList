import { CompareView } from "@/components/profile/CompareView";
import { loadViewerLibrary } from "@/lib/server/profiles";
import { getSession } from "@/lib/server/session";
import { CompareSignIn } from "@/components/profile/CompareSignIn";

export default async function ComparePage() {
  const session = await getSession();
  if (!session) return <CompareSignIn />;
  // Theirs is already in the profile's provider; yours is loaded here, once, behind the layout's boundary.
  return <CompareView mine={await loadViewerLibrary(session.userId)} />;
}
