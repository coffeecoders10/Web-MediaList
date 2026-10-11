import "server-only";
import type { AddSummary } from "@/lib/media/api";
import { mergeEntry, toUserEntry, type UserEntry } from "@/lib/media/model";
import { CATEGORIES, itemKey, parseItemKey, type Category, type MediaItem } from "@/lib/media/types";
import { BackboneError, userMedia } from "./backbone";
import { fileInCatalog, readCatalogEntry, readCatalogs } from "./catalog";

/**
 * One user's collection: a `user_media` document keyed by their Backbone `user_id`. It holds only
 * references into the shared catalog (`book-12`) plus what is personal to the user. Every function
 * takes the `userId` from the verified session, never from client input, so a user can only ever
 * reach their own document.
 */

interface UserDoc extends Record<string, unknown> {
  v: 1;
  entries: Record<string, UserEntry>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function readUserDoc(userId: string): Promise<UserDoc> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const doc = await userMedia.read<Partial<UserDoc>>(userId);
    if (doc) return { v: 1, entries: doc.entries && typeof doc.entries === "object" ? doc.entries : {} };

    // First visit (or an interrupted one): create the row and give it an initial document.
    const created = await userMedia.create(userId);
    const empty: UserDoc = { v: 1, entries: {} };
    if (created) {
      await userMedia.write(userId, empty);
      return empty;
    }
    await sleep(100); // another request is creating it right now
  }
  // The row exists but never received a document; writing one is safe because there is nothing to lose.
  const empty: UserDoc = { v: 1, entries: {} };
  await userMedia.write(userId, empty);
  return empty;
}

/**
 * Backbone documents are replaced whole, so concurrent read-modify-writes for one user would drop
 * each other's changes. This queues them per user within a server instance; the client also sends
 * its own changes one at a time, which covers requests landing on different instances.
 */
const queues = new Map<string, Promise<unknown>>();
function serial<T>(userId: string, task: () => Promise<T>): Promise<T> {
  const run = (queues.get(userId) ?? Promise.resolve()).catch(() => {}).then(task);
  queues.set(userId, run);
  void run.finally(() => queues.get(userId) === run && queues.delete(userId)).catch(() => {});
  return run;
}

export async function loadLibrary(userId: string): Promise<MediaItem[]> {
  const doc = await readUserDoc(userId);
  const refs = Object.values(doc.entries);
  const catalogs = await readCatalogs(refs.map((r) => r.category));

  const items: MediaItem[] = [];
  for (const ref of refs) {
    const entry = catalogs[ref.category]?.entries[String(ref.catalogId)];
    const item = entry && mergeEntry(entry, ref);
    if (item) items.push(item);
  }
  return items;
}

/**
 * Adds titles to the user's collection. Each is filed in the shared catalog first (reusing the
 * entry for the same work when there is one), then referenced from the user's document along with
 * their own status, progress, rating and notes. Titles the user already has are skipped.
 */
export async function addItems(userId: string, items: MediaItem[]): Promise<AddSummary> {
  const byCategory = new Map<Category, MediaItem[]>();
  for (const item of items) byCategory.set(item.category, [...(byCategory.get(item.category) ?? []), item]);

  const filedByCategory = await Promise.all(
    CATEGORIES.filter((c) => byCategory.has(c)).map(async (c) => [c, await fileInCatalog(c, byCategory.get(c)!)] as const),
  );
  const filed = new Map<MediaItem, Awaited<ReturnType<typeof fileInCatalog>>[number]>();
  for (const [category, results] of filedByCategory) byCategory.get(category)!.forEach((item, i) => filed.set(item, results[i]));

  return serial(userId, async () => {
    const doc = await readUserDoc(userId);
    const summary: AddSummary = { items: [], created: 0, matched: 0, skipped: 0 };

    for (const item of items) {
      const { entry, created } = filed.get(item)!;
      const key = itemKey(item.category, entry.id);
      if (doc.entries[key]) {
        summary.skipped++;
        continue;
      }
      const own = toUserEntry(item, entry);
      doc.entries[key] = own;
      const merged = mergeEntry(entry, own);
      if (!merged) continue;
      summary.items.push(merged);
      summary[created ? "created" : "matched"]++;
    }

    if (summary.items.length > 0) await userMedia.write(userId, doc);
    return summary;
  });
}

/** Creates or replaces the user's entry for a catalog title. Shared fields they changed become their overrides. */
export async function saveItem(userId: string, item: MediaItem): Promise<void> {
  const ref = parseItemKey(item.id);
  if (!ref || ref.category !== item.category) throw new BackboneError("Unknown title", 404);
  const entry = await readCatalogEntry(ref.category, ref.catalogId);
  if (!entry) throw new BackboneError("That title isn't in the catalog", 404);

  await serial(userId, async () => {
    const doc = await readUserDoc(userId);
    doc.entries[item.id] = toUserEntry({ ...item, catalogId: entry.id }, entry);
    await userMedia.write(userId, doc);
  });
}

/** Removes a title from the user's collection only. The shared catalog entry stays for everyone else. */
export async function removeItem(userId: string, key: string): Promise<void> {
  await serial(userId, async () => {
    const doc = await readUserDoc(userId);
    if (!(key in doc.entries)) return;
    delete doc.entries[key];
    await userMedia.write(userId, doc);
  });
}
