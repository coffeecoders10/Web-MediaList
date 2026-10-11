import { Suspense } from "react";
import { LibraryView } from "@/components/library/LibraryView";

export default function LibraryPage() {
  // LibraryView reads the URL's filters, so it renders on the client behind this boundary.
  return (
    <Suspense>
      <LibraryView />
    </Suspense>
  );
}
