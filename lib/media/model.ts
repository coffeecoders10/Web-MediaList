import { normalizeItem } from "./normalize";
import { itemKey, type Category, type MediaItem } from "./types";

/**
 * The stored shapes. The merged `MediaItem` the UI works with is split in two:
 *
 * - `CatalogEntry`: shared, canonical metadata. One per title per category, numbered 1, 2, 3...
 * - `UserEntry`: one user's relationship to a catalog entry (status, progress, rating, notes,
 *   dates), plus `overrides` for any shared field that user has edited for themselves.
 *
 * Both are stored as flat JSON and validated through `normalizeItem` whenever they are read.
 */
type Fields = Record<string, unknown>;

export interface CatalogEntry extends Fields {
  id: number;
  category: Category;
  createdAt: string;
}

export interface UserEntry extends Fields {
  category: Category;
  catalogId: number;
  overrides?: Fields;
}

const SHARED_COMMON = ["title", "creator", "year", "genres", "synopsis", "posterUrl", "art"];
const OWN_COMMON = ["status", "rating", "notes", "addedAt", "startedAt", "finishedAt", "updatedAt"];

/** Metadata that describes the work itself, and so lives in the shared catalog. */
const SHARED_KEYS: Record<Category, readonly string[]> = {
  book: [...SHARED_COMMON, "chaptersTotal", "series"],
  movie: [...SHARED_COMMON, "type", "runtimeMinutes", "series"],
  series: [...SHARED_COMMON, "totalSeasons"],
  anime: [...SHARED_COMMON, "totalSeasons", "totalEpisodes"],
};

/** What only this user knows: where they are in it, what they thought of it. */
const OWN_KEYS: Record<Category, readonly string[]> = {
  book: [...OWN_COMMON, "chaptersRead"],
  movie: OWN_COMMON,
  series: [...OWN_COMMON, "currentSeason"],
  anime: [...OWN_COMMON, "tracking", "currentSeason", "currentEpisode"],
};

function pick(source: Fields, keys: readonly string[]): Fields {
  const out: Fields = {};
  for (const key of keys) if (source[key] !== undefined) out[key] = source[key];
  return out;
}

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => same(v, b[i]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const x = a as Fields;
    const y = b as Fields;
    const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
    return [...keys].every((k) => same(x[k], y[k]));
  }
  // A missing value, null and an empty string all mean "not set" here.
  return (a || null) === (b || null);
}

export function toCatalogEntry(item: MediaItem, id: number, now = new Date().toISOString()): CatalogEntry {
  return { id, category: item.category, createdAt: now, ...pick(item as unknown as Fields, SHARED_KEYS[item.category]) };
}

/** Builds the collection entry for an item against its catalog entry; edits to shared fields become overrides. */
export function toUserEntry(item: MediaItem, catalog: CatalogEntry): UserEntry {
  const source = item as unknown as Fields;
  const overrides: Fields = {};
  for (const key of SHARED_KEYS[item.category]) {
    if (!same(source[key], catalog[key])) overrides[key] = source[key] ?? null;
  }
  const entry: UserEntry = { category: item.category, catalogId: catalog.id, ...pick(source, OWN_KEYS[item.category]) };
  if (Object.keys(overrides).length > 0) entry.overrides = overrides;
  return entry;
}

/** The full item the UI shows: catalog metadata, then this user's overrides, then their own fields. */
export function mergeEntry(catalog: CatalogEntry, user: UserEntry): MediaItem | null {
  return normalizeItem({
    ...pick(catalog, SHARED_KEYS[catalog.category]),
    ...user.overrides,
    ...pick(user, OWN_KEYS[user.category]),
    id: itemKey(user.category, user.catalogId),
    catalogId: user.catalogId,
    category: user.category,
  });
}
