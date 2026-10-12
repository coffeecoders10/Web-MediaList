import "server-only";
import type { AddSummary, Submission } from "@/lib/media/api";
import { mergeEntry, toUserEntry, type UserEntry } from "@/lib/media/model";
import { CATEGORIES, itemKey, parseItemKey, type Category, type MediaItem } from "@/lib/media/types";
import { BackboneError, userMedia } from "./backbone";
import { fileInCatalog, readCatalogs, updateCatalogEntry } from "./catalog";

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
  const catalogs = await readCatalogs(Object.values(doc.entries).map((r) => r.category));

  const items: MediaItem[] = [];
  for (const [key, ref] of Object.entries(doc.entries)) {
    if (key !== itemKey(ref.category, ref.catalogId)) continue; // a reference that doesn't point where it claims
    const entry = catalogs[ref.category]?.entries[String(ref.catalogId)];
    const item = entry && mergeEntry(entry, ref);
    if (item) items.push(item);
  }
  return items;
}

/**
 * Adds titles to the user's collection. Each is filed in the shared catalog first (reusing the
 * entry for the same work when there is one, and passing on any intentional edits to its shared
 * fields), then referenced from the user's document along with their own status, progress, rating
 * and notes. Titles the user already has are skipped.
 */
export async function addItems(userId: string, submissions: Submission[]): Promise<AddSummary> {
  const byCategory = new Map<Category, Submission[]>();
  for (const s of submissions) byCategory.set(s.item.category, [...(byCategory.get(s.item.category) ?? []), s]);

  const filedByCategory = await Promise.all(
    CATEGORIES.filter((c) => byCategory.has(c)).map(async (c) => [c, await fileInCatalog(c, byCategory.get(c)!)] as const),
  );
  const filed = new Map<Submission, Awaited<ReturnType<typeof fileInCatalog>>[number]>();
  for (const [category, results] of filedByCategory) byCategory.get(category)!.forEach((s, i) => filed.set(s, results[i]));

  return serial(userId, async () => {
    const doc = await readUserDoc(userId);
    const summary: AddSummary = { items: [], created: 0, matched: 0, skipped: 0 };

    for (const submission of submissions) {
      const { entry, created } = filed.get(submission)!;
      const key = itemKey(entry.category, entry.id);
      if (doc.entries[key]) {
        summary.skipped++;
        continue;
      }
      const own = toUserEntry(submission.item, entry.id);
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

/**
 * Saves a title already in the catalog. Intentional edits to its shared fields (compared with `base`,
 * what the form was opened with) update the catalog entry for everyone; the user's own fields are
 * saved to their reference. Returns the title as it now stands, shared metadata included.
 */
export async function saveItem(userId: string, item: MediaItem, base: MediaItem | null | undefined): Promise<MediaItem> {
  const ref = parseItemKey(item.id);
  if (!ref || ref.category !== item.category) throw new BackboneError("Unknown title", 404);
  const entry = await updateCatalogEntry(ref.category, ref.catalogId, item, base);
  if (!entry) throw new BackboneError("That title isn't in the catalog", 404);

  return serial(userId, async () => {
    const doc = await readUserDoc(userId);
    const own = toUserEntry(item, entry.id);
    doc.entries[item.id] = own;
    await userMedia.write(userId, doc);
    const merged = mergeEntry(entry, own);
    if (!merged) throw new BackboneError("That title isn't valid", 404);
    return merged;
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
