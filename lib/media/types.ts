export const CATEGORIES = ["book", "movie", "series", "anime"] as const;
export type Category = (typeof CATEGORIES)[number];

export const STATUSES = ["in-progress", "planned", "completed", "on-hold", "dropped"] as const;
export type Status = (typeof STATUSES)[number];

export const ART_PATTERNS = ["sun", "arches", "rays", "bands", "orbit", "blocks"] as const;
export type ArtPattern = (typeof ART_PATTERNS)[number];

/** Generated cover used when an entry has no poster image. */
export interface CoverArt {
  hue: number;
  pattern: ArtPattern;
}

interface MediaBase {
  id: string;
  title: string;
  /** Author, director or studio. */
  creator: string;
  year: number | null;
  status: Status;
  /** 0–10 in half-point steps; null when unrated. */
  rating: number | null;
  genres: string[];
  synopsis: string;
  notes: string;
  posterUrl: string;
  art?: CoverArt;
  /** ISO dates (yyyy-mm-dd). */
  addedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  /** ISO timestamp of the last edit. */
  updatedAt: string;
}

export interface Book extends MediaBase {
  category: "book";
  pagesTotal: number | null;
  pagesRead: number;
  chaptersTotal: number | null;
  chaptersRead: number;
  series: { name: string; volume: number; of: number | null } | null;
}

export interface Movie extends MediaBase {
  category: "movie";
  runtimeMinutes: number | null;
}

/** TV series and anime share the same episode-based progress model. */
export interface Episodic extends MediaBase {
  category: "series" | "anime";
  /** Episode count per season, in order. */
  seasons: number[];
  /** Episodes watched across all seasons, counted from the first. */
  watchedEpisodes: number;
}

export type MediaItem = Book | Movie | Episodic;

export const CATEGORY_LABEL: Record<Category, { singular: string; plural: string }> = {
  book: { singular: "Book", plural: "Books" },
  movie: { singular: "Movie", plural: "Movies" },
  series: { singular: "TV series", plural: "TV series" },
  anime: { singular: "Anime", plural: "Anime" },
};

export const STATUS_LABEL: Record<Status, string> = {
  "in-progress": "In progress",
  planned: "Planned",
  completed: "Completed",
  "on-hold": "On hold",
  dropped: "Dropped",
};

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

export function isStatus(value: unknown): value is Status {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}
