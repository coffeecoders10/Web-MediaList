import "server-only";
import { findMatch, normalizeTitle } from "@/lib/media/match";
import type { Submission } from "@/lib/media/api";
import { mergeEntry, sharedChanges, toCatalogEntry, type CatalogEntry } from "@/lib/media/model";
import { searchEntries } from "@/lib/media/search";
import { CATEGORIES, type Category, type MediaItem } from "@/lib/media/types";
import { BackboneError, mediaList, userMedia } from "./backbone";
import { withLock } from "./lock";

/**
 * The shared media catalog: one `media_list` row per category, holding every entry of that category
 * under ids 1, 2, 3... that this module assigns. Rows are server-numbered by Backbone and cannot be
 * listed, so a manifest records which row belongs to which category.
 */

interface CatalogDoc extends Record<string, unknown> {
  v: 1;
  category: Category;
  /** The id the next new entry gets. Never reused, even if entries are ever removed. */
  nextId: number;
  entries: Record<string, CatalogEntry>;
}

type Manifest = Record<Category, number>;

/** Lives in the `user_media` table, which is the only place the docs let us choose a row id. */
const MANIFEST_ID = "__catalog_manifest__";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isManifest(doc: unknown): doc is { rows: Manifest } {
  const rows = (doc as { rows?: Record<string, unknown> } | null)?.rows;
  return !!rows && CATEGORIES.every((c) => typeof rows[c] === "number");
}

const emptyCatalog = (category: Category): CatalogDoc => ({ v: 1, category, nextId: 1, entries: {} });

/**
 * Finds the catalog rows, creating them on first use. Creating the manifest row is atomic, so
 * exactly one process does the setup while any others wait for it to finish.
 */
async function loadManifest(): Promise<Manifest> {
  const deadline = Date.now() + 20_000;
  let unreadableSince: number | null = null;

  while (Date.now() < deadline) {
    const existing = await userMedia.read<unknown>(MANIFEST_ID);
    if (isManifest(existing)) return existing.rows;

    if (await userMedia.create(MANIFEST_ID)) {
      try {
        const rows = {} as Manifest;
        await Promise.all(
          CATEGORIES.map(async (category) => {
            const id = await mediaList.create(`catalog:${category}`, `Shared ${category} catalog`);
            await mediaList.write(id, emptyCatalog(category));
            rows[category] = id;
          }),
        );
        await userMedia.write(MANIFEST_ID, { v: 1, rows });
        return rows;
      } catch (error) {
        // Free the id so the next attempt can start over; any rows made so far are just unused.
        await userMedia.remove(MANIFEST_ID).catch(() => {});
        throw error;
      }
    }

    // Someone else is mid-setup. If the row stays unreadable, its owner died: clear it and retry.
    unreadableSince ??= Date.now();
    if (Date.now() - unreadableSince > 8_000) {
      await userMedia.remove(MANIFEST_ID);
      unreadableSince = null;
    }
    await sleep(150);
  }
  throw new BackboneError("Timed out setting up the shared catalog", 503);
}

// The row ids never change once created, so the lookup is remembered for the life of the process.
let manifest: Promise<Manifest> | null = null;
function catalogRows(): Promise<Manifest> {
  manifest ??= loadManifest().catch((error) => {
    manifest = null;
    throw error;
  });
  return manifest;
}

async function readCatalog(category: Category): Promise<CatalogDoc> {
  const rows = await catalogRows();
  const doc = await mediaList.read<Partial<CatalogDoc> | null>(rows[category]);
  const entries = doc?.entries && typeof doc.entries === "object" ? doc.entries : {};
  const highest = Math.max(0, ...Object.values(entries).map((e) => e.id));
  return { v: 1, category, entries, nextId: Math.max(doc?.nextId ?? 1, highest + 1) };
}

/** Reads the catalogs for the given categories, in parallel. */
export async function readCatalogs(categories: Iterable<Category>): Promise<Partial<Record<Category, CatalogDoc>>> {
  const wanted = [...new Set(categories)];
  const docs = await Promise.all(wanted.map(readCatalog));
  return Object.fromEntries(wanted.map((c, i) => [c, docs[i]]));
}

/**
 * Title search reads a category's whole catalog on every keystroke, so it works from a short-lived
 * copy instead. Filing a title refreshes the copy on this instance; other instances catch up within
 * the TTL, which only means a brand-new title can take a few seconds to show up as a suggestion.
 */
const SEARCH_TTL_MS = 15_000;
const searchCache = new Map<Category, { at: number; entries: CatalogEntry[] }>();

async function searchableEntries(category: Category): Promise<CatalogEntry[]> {
  const cached = searchCache.get(category);
  if (cached && Date.now() - cached.at < SEARCH_TTL_MS) return cached.entries;
  const entries = Object.values((await readCatalog(category)).entries);
  searchCache.set(category, { at: Date.now(), entries });
  return entries;
}

/** Shared catalog titles of one category that match what the user is typing, as items with default personal fields. */
export async function searchCatalog(category: Category, query: string): Promise<MediaItem[]> {
  const matches = searchEntries(await searchableEntries(category), query);
  return matches.flatMap((entry) => mergeEntry(entry, { category, catalogId: entry.id }) ?? []);
}

/** A few random catalog titles, each from a different category, preferring ones that have a poster. */
export async function randomCatalogItems(count: number): Promise<MediaItem[]> {
  const shuffle = <T,>(list: T[]) => list.map((v) => [Math.random(), v] as const).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
  const pools = await Promise.all(
    CATEGORIES.map(async (category) => {
      const items = (await searchableEntries(category)).flatMap((entry) => mergeEntry(entry, { category, catalogId: entry.id }) ?? []);
      const [withPoster, without] = [items.filter((i) => i.posterUrl), items.filter((i) => !i.posterUrl)];
      return [...shuffle(withPoster), ...shuffle(without)];
    }),
  );
  const picks = shuffle(pools.filter((pool) => pool.length > 0)).map((pool) => pool[0]);
  return picks.slice(0, count);
}

export async function readCatalogEntry(category: Category, catalogId: number): Promise<CatalogEntry | null> {
  return (await readCatalog(category)).entries[String(catalogId)] ?? null;
}

/**
 * The entry an item was explicitly picked from (title suggestions). The id is only trusted while the
 * title still agrees with it, so an id carried in an imported file can't attach a different work.
 */
function linkedEntry(item: MediaItem, doc: CatalogDoc): CatalogEntry | null {
  const entry = item.catalogId > 0 ? doc.entries[String(item.catalogId)] : undefined;
  const sameWork = entry && entry.category === item.category && normalizeTitle(String(entry.title ?? "")) === normalizeTitle(item.title);
  return sameWork ? entry : null;
}

export interface Filed {
  entry: CatalogEntry;
  /** True when this call created the entry; false when it matched one already in the catalog. */
  created: boolean;
}

/** Fields that say which work an entry is. Changing one must not turn the entry into a copy of another. */
const IDENTITY_KEYS = ["title", "creator", "year", "series"];

/**
 * The entry with the intentional shared-field changes in `item` applied (`entry` itself when there are
 * none). Throws if the change would make it the same work as another entry, since the catalog never
 * holds two of those.
 */
function amend(entry: CatalogEntry, others: CatalogEntry[], item: MediaItem, base: MediaItem | null | undefined): CatalogEntry {
  const changes = sharedChanges(item, base, entry);
  if (Object.keys(changes).length === 0) return entry;

  const updated: CatalogEntry = { ...entry, ...changes };
  if (IDENTITY_KEYS.some((key) => key in changes)) {
    const asItem = mergeEntry(updated, { category: entry.category, catalogId: entry.id });
    if (asItem && findMatch(asItem, others.filter((e) => e.id !== entry.id))) {
      throw new BackboneError("Another title in the shared catalog already has that title, creator and year.", 409);
    }
  }
  return updated;
}

const remember = (category: Category, entries: CatalogEntry[]) => searchCache.set(category, { at: Date.now(), entries });

/**
 * Files each submission in its category's catalog: reuses the entry for the same work if there is one
 * (applying any intentional changes to its shared fields), otherwise creates it. The read-match-write
 * runs under a lock per category, so users adding the same new title at the same moment end up sharing
 * one entry instead of creating two.
 */
export async function fileInCatalog(category: Category, submissions: Submission[]): Promise<Filed[]> {
  return withLock(`catalog:${category}`, async () => {
    const doc = await readCatalog(category);
    const known = Object.values(doc.entries);
    const now = new Date().toISOString();
    let changed = false;

    const filed = submissions.map(({ item, base }): Filed => {
      const match = linkedEntry(item, doc) ?? findMatch(item, known);
      if (match) {
        const entry = amend(match, known, item, base);
        if (entry !== match) {
          doc.entries[String(entry.id)] = entry;
          known[known.indexOf(match)] = entry;
          changed = true;
        }
        return { entry, created: false };
      }
      const entry = toCatalogEntry(item, doc.nextId++, now);
      doc.entries[String(entry.id)] = entry;
      known.push(entry);
      changed = true;
      return { entry, created: true };
    });

    if (changed) {
      await mediaList.write((await catalogRows())[category], doc);
      remember(category, known);
    }
    return filed;
  });
}

/**
 * Applies the intentional shared-field changes in `item` to an existing entry, for every user who has
 * it. Returns the entry as it now is, or null if it doesn't exist. Reads without the lock first, so
 * saving only personal progress never takes it.
 */
export async function updateCatalogEntry(
  category: Category,
  catalogId: number,
  item: MediaItem,
  base: MediaItem | null | undefined,
): Promise<CatalogEntry | null> {
  const current = await readCatalogEntry(category, catalogId);
  if (!current || Object.keys(sharedChanges(item, base, current)).length === 0) return current;

  return withLock(`catalog:${category}`, async () => {
    const doc = await readCatalog(category);
    const entry = doc.entries[String(catalogId)];
    if (!entry) return null;

    const updated = amend(entry, Object.values(doc.entries), item, base);
    if (updated !== entry) {
      doc.entries[String(catalogId)] = updated;
      await mediaList.write((await catalogRows())[category], doc);
      remember(category, Object.values(doc.entries));
    }
    return updated;
  });
}
