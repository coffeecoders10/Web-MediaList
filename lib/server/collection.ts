import "server-only";
import type { AddSummary, Submission } from "@/lib/media/api";
import { reconcile } from "@/lib/media/progress";
import { mergeEntry, toUserEntry, type UserEntry } from "@/lib/media/model";
import { CATEGORIES, itemKey, parseItemKey, type Category, type MediaItem, type Status } from "@/lib/media/types";
import { BackboneError, userMedia } from "./backbone";
import { readOrCreate, serial as queue } from "./documents";
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

async function readUserDoc(userId: string): Promise<UserDoc> {
  const doc = await readOrCreate<UserDoc>(userId, { v: 1, entries: {} });
  return { v: 1, entries: doc.entries && typeof doc.entries === "object" ? doc.entries : {} };
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

  return queue(userId, async () => {
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
 * Adds existing shared catalog titles to the user's collection, as completed unless `status` says
 * otherwise. Nothing personal is invented: no rating, dates or notes, just the status and the progress
 * that goes with it (the full total for Completed, none for Planned). Titles already held are skipped.
 */
export async function addCatalogTitles(userId: string, keys: string[], status: Status = "completed"): Promise<AddSummary> {
  const refs = keys.flatMap((key) => parseItemKey(key) ?? []);
  const catalogs = await readCatalogs(refs.map((r) => r.category));

  return queue(userId, async () => {
    const doc = await readUserDoc(userId);
    const summary: AddSummary = { items: [], created: 0, matched: 0, skipped: 0 };

    for (const ref of refs) {
      const key = itemKey(ref.category, ref.catalogId);
      const entry = catalogs[ref.category]?.entries[String(ref.catalogId)];
      if (!entry) continue; // gone from the catalog since the list was loaded
      if (doc.entries[key]) {
        summary.skipped++;
        continue;
      }
      const blank = mergeEntry(entry, { category: ref.category, catalogId: ref.catalogId });
      if (!blank) continue;
      const own = toUserEntry(reconcile({ ...blank, status }), entry.id);
      doc.entries[key] = own;
      const merged = mergeEntry(entry, own);
      if (!merged) continue;
      summary.items.push(merged);
      summary.matched++;
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

  return queue(userId, async () => {
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
  await queue(userId, async () => {
    const doc = await readUserDoc(userId);
    if (!(key in doc.entries)) return;
    delete doc.entries[key];
    await userMedia.write(userId, doc);
  });
}
