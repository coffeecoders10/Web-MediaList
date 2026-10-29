import { isCategory, isStatus, seriesOf, type Category, type MediaItem, type Status } from "./types";

export const SORTS = ["updated", "added", "rating", "title", "year"] as const;
export type SortKey = (typeof SORTS)[number];

export const SORT_LABEL: Record<SortKey, string> = {
  updated: "Updated",
  added: "Added",
  rating: "Ratings",
  title: "Title",
  year: "New",
};

export interface LibraryFilters {
  q: string;
  category: Category | null;
  statuses: Status[];
  genres: string[];
  /** Minimum rating; 0 means any (including unrated), -1 means unrated only. */
  minRating: number;
  sort: SortKey;
  view: "grid" | "list";
}

export const DEFAULT_FILTERS: LibraryFilters = {
  q: "",
  category: null,
  statuses: [],
  genres: [],
  minRating: 0,
  sort: "updated",
  view: "grid",
};

type Params = Pick<URLSearchParams, "get" | "getAll">;

export function filtersFromParams(params: Params): LibraryFilters {
  const category = params.get("category");
  const sort = params.get("sort");
  const ratingParam = params.get("rating");
  const minRating = ratingParam === "unrated" ? -1 : Number(ratingParam);
  return {
    q: params.get("q") ?? "",
    category: isCategory(category) ? category : null,
    statuses: params.getAll("status").filter(isStatus),
    genres: params.getAll("genre"),
    minRating: minRating === -1 ? -1 : Number.isFinite(minRating) && minRating > 0 ? Math.min(minRating, 10) : 0,
    sort: (SORTS as readonly string[]).includes(sort ?? "") ? (sort as SortKey) : DEFAULT_FILTERS.sort,
    view: params.get("view") === "list" ? "list" : "grid",
  };
}

/** Serialises only what differs from the defaults so URLs stay short. */
export function filtersToParams(f: LibraryFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.category) p.set("category", f.category);
  f.statuses.forEach((s) => p.append("status", s));
  f.genres.forEach((g) => p.append("genre", g));
  if (f.minRating === -1) p.set("rating", "unrated");
  else if (f.minRating > 0) p.set("rating", String(f.minRating));
  if (f.sort !== DEFAULT_FILTERS.sort) p.set("sort", f.sort);
  if (f.view !== DEFAULT_FILTERS.view) p.set("view", f.view);
  return p;
}

export function activeFilterCount(f: LibraryFilters): number {
  return (f.q ? 1 : 0) + (f.category ? 1 : 0) + f.statuses.length + f.genres.length + (f.minRating !== 0 ? 1 : 0);
}

const fold = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();

function matchesQuery(item: MediaItem, q: string): boolean {
  const haystack = fold(
    [item.title, item.creator, item.genres.join(" "), seriesOf(item)?.name ?? ""].join(" "),
  );
  return fold(q)
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

export function applyFilters(items: MediaItem[], f: LibraryFilters): MediaItem[] {
  const out = items.filter((item) => {
    if (f.category && item.category !== f.category) return false;
    if (f.statuses.length && !f.statuses.includes(item.status)) return false;
    if (f.genres.length && !f.genres.every((g) => item.genres.includes(g))) return false;
    if (f.minRating === -1 && item.rating) return false;
    if (f.minRating > 0 && (item.rating ?? 0) < f.minRating) return false;
    return !f.q || matchesQuery(item, f.q);
  });
  return out.sort(comparators[f.sort]);
}

const byTitle = (a: MediaItem, b: MediaItem) => a.title.localeCompare(b.title);

const comparators: Record<SortKey, (a: MediaItem, b: MediaItem) => number> = {
  updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt) || byTitle(a, b),
  added: (a, b) => b.addedAt.localeCompare(a.addedAt) || byTitle(a, b),
  title: byTitle,
  // Unrated entries sink to the bottom.
  rating: (a, b) => (b.rating ?? -1) - (a.rating ?? -1) || byTitle(a, b),
  year: (a, b) => (b.year ?? 0) - (a.year ?? 0) || byTitle(a, b),
};

export function allGenres(items: MediaItem[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) for (const g of item.genres) counts.set(g, (counts.get(g) ?? 0) + 1);
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
