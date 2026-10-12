"use client";

import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { addToCollection, removeFromCollection, saveToCollection } from "@/app/actions/library";
import type { AddSummary, Submission } from "./api";
import { normalizeList } from "./normalize";
import type { MediaItem } from "./types";

export type AddOutcome = ({ ok: true } & AddSummary) | { ok: false; error: string };

interface MediaStore {
  items: MediaItem[];
  get: (id: string) => MediaItem | undefined;
  /**
   * Saves changes to an entry already in the collection (also re-adds one that was just removed).
   * Optimistic. Edits to shared metadata go to the catalog entry, so the server's version of the
   * title replaces the optimistic one once it answers.
   */
  save: (item: MediaItem) => void;
  /** Adds new titles; waits for the server because it decides their ids. */
  add: (titles: Submission[]) => Promise<AddOutcome>;
  remove: (id: string) => MediaItem | undefined;
  exportJson: () => string;
  /** Adds the titles in a JSON export. Returns how many were new to the collection, or null when the file held none. */
  importJson: (json: string) => Promise<AddOutcome | null>;
  /** Registers a listener for background failures (a save the server rejected). Returns its unsubscribe. */
  onError: (listener: (message: string) => void) => () => void;
}

const MediaContext = createContext<MediaStore | null>(null);

/** Imports go up in slices so a large file stays under the request size limit. */
const CHUNK = 100;

export function MediaProvider({ initialItems, children }: { initialItems: MediaItem[]; children: ReactNode }) {
  const [items, setItems] = useState(initialItems);
  const itemsRef = useRef(items);
  const listeners = useRef(new Set<(message: string) => void>());
  // Writes go to the server one at a time, in the order they were made, so a quick run of
  // edits can never arrive out of order and leave an older value behind.
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const fail = useCallback((message: string) => listeners.current.forEach((l) => l(message)), []);

  const enqueue = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const run = queue.current.then(task, task);
    queue.current = run.catch(() => {});
    return run;
  }, []);

  const get = useCallback((id: string) => items.find((i) => i.id === id), [items]);

  const save = useCallback(
    (item: MediaItem) => {
      const stamped = { ...item, updatedAt: new Date().toISOString() } as MediaItem;
      const before = itemsRef.current.find((i) => i.id === stamped.id);
      setItems((prev) => (prev.some((i) => i.id === stamped.id) ? prev.map((i) => (i.id === stamped.id ? stamped : i)) : [stamped, ...prev]));
      void enqueue(() => saveToCollection(stamped, before)).then((result) => {
        if (result.ok) {
          // Show what the catalog now holds, unless a newer edit has already replaced this one.
          setItems((prev) => prev.map((i) => (i.id === stamped.id && i.updatedAt === stamped.updatedAt ? result.item : i)));
          return;
        }
        // Put back what was there before this edit.
        setItems((prev) => (before ? prev.map((i) => (i.id === before.id ? before : i)) : prev.filter((i) => i.id !== stamped.id)));
        fail(`Couldn't save “${stamped.title}”. ${result.error}`);
      });
    },
    [enqueue, fail],
  );

  const add = useCallback(
    async (batch: Submission[]): Promise<AddOutcome> => {
      const summary: AddSummary = { items: [], created: 0, matched: 0, skipped: 0 };
      for (let i = 0; i < batch.length; i += CHUNK) {
        let result;
        try {
          result = await enqueue(() => addToCollection(batch.slice(i, i + CHUNK)));
        } catch {
          return { ok: false, error: "Couldn't reach the server. Check your connection and try again." };
        }
        if (!result.ok) return result;
        summary.items.push(...result.items);
        summary.created += result.created;
        summary.matched += result.matched;
        summary.skipped += result.skipped;
      }
      const added = summary.items;
      setItems((prev) => [...added, ...prev.filter((p) => !added.some((a) => a.id === p.id))]);
      return { ok: true, ...summary };
    },
    [enqueue],
  );

  const remove = useCallback(
    (id: string) => {
      const removed = itemsRef.current.find((i) => i.id === id);
      if (!removed) return undefined;
      setItems((prev) => prev.filter((i) => i.id !== id));
      void enqueue(() => removeFromCollection(id)).then((result) => {
        if (result.ok) return;
        setItems((prev) => (prev.some((i) => i.id === id) ? prev : [removed, ...prev]));
        fail(`Couldn't delete “${removed.title}”. ${result.error}`);
      });
      return removed;
    },
    [enqueue, fail],
  );

  const exportJson = useCallback(() => JSON.stringify(items, null, 2), [items]);

  const importJson = useCallback(
    async (json: string) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        return null;
      }
      const list = normalizeList(parsed);
      return list.length === 0 ? null : add(list.map((item) => ({ item })));
    },
    [add],
  );

  const onError = useCallback((listener: (message: string) => void) => {
    listeners.current.add(listener);
    return () => void listeners.current.delete(listener);
  }, []);

  const value = useMemo(
    () => ({ items, get, save, add, remove, exportJson, importJson, onError }),
    [items, get, save, add, remove, exportJson, importJson, onError],
  );

  return <MediaContext value={value}>{children}</MediaContext>;
}

export function useMedia(): MediaStore {
  const ctx = use(MediaContext);
  if (!ctx) throw new Error("useMedia must be used inside <MediaProvider>");
  return ctx;
}
