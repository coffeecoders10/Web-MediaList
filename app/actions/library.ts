"use server";

import type { ActionResult, AddSummary } from "@/lib/media/api";
import { normalizeItem, normalizeList } from "@/lib/media/normalize";
import { BackboneError } from "@/lib/server/backbone";
import { addItems, removeItem, saveItem } from "@/lib/server/collection";
import { requireSession } from "@/lib/server/session";

/**
 * Every action re-checks the session itself (a Server Action is a public endpoint) and takes the
 * user id from it, never from the arguments. Arguments are untrusted and re-validated here.
 */

const MAX_IMPORT = 500;

function failure(error: unknown): { ok: false; error: string } {
  console.error("[library]", error);
  if (error instanceof BackboneError && error.status === 404) return { ok: false, error: "That title is no longer available." };
  return { ok: false, error: "Couldn't reach your library. Check your connection and try again." };
}

/** Adds new titles (or imports a batch). Reuses shared catalog entries where the same work exists. */
export async function addToCollection(raw: unknown): Promise<ActionResult<AddSummary>> {
  const { userId } = await requireSession();
  const items = normalizeList(raw).slice(0, MAX_IMPORT);
  if (items.length === 0) return { ok: false, error: "There's nothing valid to add." };
  try {
    return { ok: true, ...(await addItems(userId, items)) };
  } catch (error) {
    return failure(error);
  }
}

/** Saves the user's own changes to a title already in the catalog: status, progress, rating, notes, dates. */
export async function saveToCollection(raw: unknown): Promise<ActionResult> {
  const { userId } = await requireSession();
  const item = normalizeItem(raw);
  if (!item) return { ok: false, error: "That title isn't valid." };
  try {
    await saveItem(userId, item);
    return { ok: true };
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
