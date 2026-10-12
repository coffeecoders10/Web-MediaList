import { useSyncExternalStore } from "react";
import { normalizeList } from "./normalize";
import type { MediaItem } from "./types";

/**
 * Before accounts, the collection lived in this browser's localStorage. These helpers find that
 * data so it can be offered for import into the signed-in account. The stored copy is never
 * deleted, so nothing is lost if the import is declined or fails.
 */

const LEGACY_KEY = "the-archive:collection:v1";
const doneKey = (userId: string) => `the-archive:legacy-imported:${userId}`;
const dismissedKey = (userId: string) => `the-archive:legacy-dismissed:${userId}`;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function readLegacyItems(): MediaItem[] {
  try {
    const stored = window.localStorage.getItem(LEGACY_KEY);
    return stored ? normalizeList(JSON.parse(stored)) : [];
  } catch {
    return [];
  }
}

// Snapshots are read on every render, so only re-parse when the stored text changes.
let counted: { raw: string | null; count: number } = { raw: null, count: 0 };
function legacyCount(): number {
  const raw = read(LEGACY_KEY);
  if (raw !== counted.raw) counted = { raw, count: raw ? readLegacyItems().length : 0 };
  return counted.count;
}

const read = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string) => {
  try {
    window.localStorage.setItem(key, new Date().toISOString());
  } catch {
    // Without storage the offer simply shows again next visit.
  }
  emit();
};

/** Titles waiting in this browser that this user hasn't imported yet, and whether they waved the offer away. */
export function useLegacy(userId: string): { count: number; dismissed: boolean } {
  const count = useSyncExternalStore(
    subscribe,
    () => (read(doneKey(userId)) ? 0 : legacyCount()),
    () => 0,
  );
  const dismissed = useSyncExternalStore(
    subscribe,
    () => read(dismissedKey(userId)) !== null,
    () => true,
  );
  return { count, dismissed };
}

export const markLegacyImported = (userId: string) => write(doneKey(userId));
export const dismissLegacyOffer = (userId: string) => write(dismissedKey(userId));
