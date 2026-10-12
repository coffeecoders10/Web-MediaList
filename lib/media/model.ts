import { normalizeItem } from "./normalize";
import { itemKey, type Category, type MediaItem } from "./types";

/**
 * The stored shapes. The merged `MediaItem` the UI works with is split in two:
 *
 * - `CatalogEntry`: shared, canonical metadata. One per title per category, numbered 1, 2, 3...
 * - `UserEntry`: one user's reference to a catalog entry plus what is personal to them (status,
 *   progress, rating, notes, dates). It never holds metadata about the work.
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

/** The collection entry for an item: a reference to its catalog entry and the user's own fields. */
export function toUserEntry(item: MediaItem, catalogId: number): UserEntry {
  return { category: item.category, catalogId, ...pick(item as unknown as Fields, OWN_KEYS[item.category]) };
}

const isEmpty = (v: unknown) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);

/**
 * The shared fields of `item` that should be written to `entry`: the intentional changes only.
 *
 * - `base` is the shared data the form was opened with (ignored unless it is for this same entry). A
 *   field counts as changed when it differs from `base`, so a stale copy of a field someone else has
 *   since corrected is never written back.
 * - Without a `base` (a title typed by hand that turned out to exist already) nothing is known to be
 *   intentional, so a field is only filled in where the entry has no value yet.
 * - An empty value never overwrites anything, and a value the entry already has is not rewritten.
 */
export function sharedChanges(item: MediaItem, base: MediaItem | null | undefined, entry: CatalogEntry): Fields {
  const source = item as unknown as Fields;
  const opened = base && base.category === entry.category && base.catalogId === entry.id ? (base as unknown as Fields) : null;
  const changes: Fields = {};
  for (const key of SHARED_KEYS[entry.category]) {
    const value = source[key];
    if (isEmpty(value) || same(value, entry[key])) continue;
    if (opened ? same(value, opened[key]) : !isEmpty(entry[key])) continue;
    changes[key] = value;
  }
  return changes;
}

/** The full item the UI shows: the catalog's metadata plus this user's own fields. */
export function mergeEntry(catalog: CatalogEntry, user: UserEntry): MediaItem | null {
  return normalizeItem({
    ...pick(catalog, SHARED_KEYS[catalog.category]),
    ...pick(user, OWN_KEYS[user.category]),
    id: itemKey(user.category, user.catalogId),
    catalogId: user.catalogId,
    category: user.category,
  });
}
