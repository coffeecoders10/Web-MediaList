import type { Category, MediaItem } from "./types";

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

/** One shared catalog title as the bulk-add picker lists it: just enough to recognise and filter it. */
export interface BrowseEntry {
  /** Collection key (`book-12`), the same id the title has once it is in a collection. */
  key: string;
  category: Category;
  title: string;
  creator: string;
  year: number | null;
  genres: string[];
}

/** The `/api/catalog/browse` response: every shared catalog title, for picking several at once. */
export interface CatalogBrowseResult {
  entries: BrowseEntry[];
}

/** The `/api/catalog/search` response: shared catalog titles with personal fields left at their defaults. */
export interface CatalogSearchResult {
  results: MediaItem[];
}
