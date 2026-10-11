import type { MediaItem } from "./types";

/** What the library Server Actions return. Expected failures come back as values, not exceptions. */
export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export interface AddSummary {
  /** The entries now in the collection, with their real ids (not the ones that were already there). */
  items: MediaItem[];
  /** Entries newly added to the shared catalog. */
  created: number;
  /** Entries that matched an existing shared catalog entry. */
  matched: number;
  /** Entries the collection already held. */
  skipped: number;
}
