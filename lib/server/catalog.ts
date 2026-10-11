import "server-only";
import { findMatch } from "@/lib/media/match";
import { toCatalogEntry, type CatalogEntry } from "@/lib/media/model";
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

export async function readCatalogEntry(category: Category, catalogId: number): Promise<CatalogEntry | null> {
  return (await readCatalog(category)).entries[String(catalogId)] ?? null;
}

export interface Filed {
  entry: CatalogEntry;
  /** True when this call created the entry; false when it matched one already in the catalog. */
  created: boolean;
}

/**
 * Files each item in its category's catalog: reuses the entry for the same work if there is one,
 * otherwise creates it. The read-match-write runs under a lock per category, so users adding the
 * same new title at the same moment end up sharing one entry instead of creating two.
 */
export async function fileInCatalog(category: Category, items: MediaItem[]): Promise<Filed[]> {
  return withLock(`catalog:${category}`, async () => {
    const doc = await readCatalog(category);
    const known = Object.values(doc.entries);
    const now = new Date().toISOString();
    let changed = false;

    const filed = items.map((item): Filed => {
      const match = findMatch(item, known);
      if (match) return { entry: match, created: false };
      const entry = toCatalogEntry(item, doc.nextId++, now);
      doc.entries[String(entry.id)] = entry;
      known.push(entry);
      changed = true;
      return { entry, created: true };
    });

    if (changed) await mediaList.write((await catalogRows())[category], doc);
    return filed;
  });
}
