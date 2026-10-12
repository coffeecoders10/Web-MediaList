import type { MediaItem } from "./types";

/** What the library Server Actions return. Expected failures come back as values, not exceptions. */
export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** A title to add, with the shared data its form was opened with, if it was filled from a catalog title. */
export interface Submission {
  item: MediaItem;
  base?: MediaItem | null;
}

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

/** The `/api/catalog/search` response: shared catalog titles with personal fields left at their defaults. */
export interface CatalogSearchResult {
  results: MediaItem[];
}
