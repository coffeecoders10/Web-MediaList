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
  /** Collection key, `${category}-${catalogId}`. Temporary (and catalogId 0) until the server files the entry. */
  id: string;
  /** Id of the shared catalog entry within its category; 0 for entries not yet in the catalog. */
  catalogId: number;
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

/** The series (books) or franchise (movies) a work belongs to. */
export interface WorkSeries {
  name: string;
  /** Volume (books) or part (movies) number within the series; null when unknown. */
  volume: number | null;
}

export interface Book extends MediaBase {
  category: "book";
  chaptersTotal: number | null;
  chaptersRead: number;
  series: WorkSeries | null;
}

export interface Movie extends MediaBase {
  category: "movie";
  /** Free-form kind of film, e.g. "Hollywood" or "Bollywood"; empty when not set. */
  type: string;
  runtimeMinutes: number | null;
  series: WorkSeries | null;
}

/** TV series are tracked by season only: how many there are, and which one you are on. */
export interface Series extends MediaBase {
  category: "series";
  totalSeasons: number | null;
  /** The season being watched; 0 before the first. */
  currentSeason: number;
}

export const TRACKING_MODES = ["seasons", "episodes"] as const;
export type TrackingMode = (typeof TRACKING_MODES)[number];

/**
 * Anime is tracked either by season or by episode. `tracking` picks which pair counts; the other pair
 * is kept so switching modes never loses what was entered.
 */
export interface Anime extends MediaBase {
  category: "anime";
  tracking: TrackingMode;
  totalSeasons: number | null;
  currentSeason: number;
  totalEpisodes: number | null;
  currentEpisode: number;
}

export type MediaItem = Book | Movie | Series | Anime;

/** The series an item belongs to; only books and movies have one. */
export function seriesOf(item: MediaItem): WorkSeries | null {
  return item.category === "book" || item.category === "movie" ? item.series : null;
}

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

/** Key of a collection entry: stable, URL-safe, and unique across categories. */
export const itemKey = (category: Category, catalogId: number) => `${category}-${catalogId}`;

export function parseItemKey(key: string): { category: Category; catalogId: number } | null {
  const match = /^(book|movie|series|anime)-([1-9]\d*)$/.exec(key);
  return match ? { category: match[1] as Category, catalogId: Number(match[2]) } : null;
}

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

export function isTrackingMode(value: unknown): value is TrackingMode {
  return typeof value === "string" && (TRACKING_MODES as readonly string[]).includes(value);
}

export function isStatus(value: unknown): value is Status {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}
