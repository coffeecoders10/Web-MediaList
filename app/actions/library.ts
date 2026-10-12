"use server";

import type { ActionResult, AddSummary } from "@/lib/media/api";
import { normalizeItem, normalizeSubmissions } from "@/lib/media/normalize";
import type { MediaItem } from "@/lib/media/types";
import { BackboneError } from "@/lib/server/backbone";
import { addCatalogTitles, addItems, removeItem, saveItem } from "@/lib/server/collection";
import { requireSession } from "@/lib/server/session";

/**
 * Every action re-checks the session itself (a Server Action is a public endpoint) and takes the
 * user id from it, never from the arguments. Arguments are untrusted and re-validated here.
 */

const MAX_IMPORT = 500;

function failure(error: unknown): { ok: false; error: string } {
  console.error("[library]", error);
  if (error instanceof BackboneError && error.status === 404) return { ok: false, error: "That title is no longer available." };
  if (error instanceof BackboneError && error.status === 409) return { ok: false, error: error.message };
  return { ok: false, error: "Couldn't reach your library. Check your connection and try again." };
}

/** Adds new titles (or imports a batch). Reuses shared catalog entries where the same work exists. */
export async function addToCollection(raw: unknown): Promise<ActionResult<AddSummary>> {
  const { userId } = await requireSession();
  const submissions = normalizeSubmissions(raw).slice(0, MAX_IMPORT);
  if (submissions.length === 0) return { ok: false, error: "There's nothing valid to add." };
  try {
    return { ok: true, ...(await addItems(userId, submissions)) };
  } catch (error) {
    return failure(error);
  }
}

/** Adds existing shared catalog titles, by key, as completed. Personal fields are left for the user to fill in. */
export async function addCatalogTitlesToCollection(raw: unknown): Promise<ActionResult<AddSummary>> {
  const { userId } = await requireSession();
  const keys = Array.isArray(raw) ? [...new Set(raw.filter((k): k is string => typeof k === "string"))].slice(0, MAX_IMPORT) : [];
  if (keys.length === 0) return { ok: false, error: "Pick at least one title to add." };
  try {
    return { ok: true, ...(await addCatalogTitles(userId, keys)) };
  } catch (error) {
    return failure(error);
  }
}

/**
 * Saves a title already in the catalog: the user's own status, progress, rating, notes and dates, plus any
 * intentional edits to its shared metadata (judged against `rawBase`, what the edit started from).
 */
export async function saveToCollection(raw: unknown, rawBase?: unknown): Promise<ActionResult<{ item: MediaItem }>> {
  const { userId } = await requireSession();
  const item = normalizeItem(raw);
  if (!item) return { ok: false, error: "That title isn't valid." };
  try {
    return { ok: true, item: await saveItem(userId, item, normalizeItem(rawBase)) };
  } catch (error) {
    return failure(error);
  }
}

export async function removeFromCollection(key: unknown): Promise<ActionResult> {
  const { userId } = await requireSession();
  if (typeof key !== "string") return { ok: false, error: "That title isn't valid." };
  try {
    await removeItem(userId, key);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}
