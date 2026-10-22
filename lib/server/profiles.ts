import "server-only";
import { cache } from "react";
import type { MediaItem } from "@/lib/media/types";
import { loadLibrary } from "./collection";

/** A collection as other people see it: the same titles, minus private notes. Memoized per request. */
export const loadPublicLibrary = cache(async (userId: string): Promise<MediaItem[]> => {
  const items = await loadLibrary(userId);
  return items.map((item) => ({ ...item, notes: "" }));
});

/** The signed-in viewer's own collection, for "already in your list" and comparing. Memoized per request. */
export const loadViewerLibrary = cache((userId: string) => loadLibrary(userId));
