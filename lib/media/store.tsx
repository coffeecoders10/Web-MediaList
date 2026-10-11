"use client";

import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { normalizeList } from "./normalize";
import { mediaRepository } from "./repository";
import type { MediaItem } from "./types";

interface MediaStore {
  items: MediaItem[];
  /** False until the collection has been read from storage. */
  ready: boolean;
  get: (id: string) => MediaItem | undefined;
  /** Creates or replaces an entry and stamps its update time. */
  save: (item: MediaItem) => void;
  remove: (id: string) => MediaItem | undefined;
  exportJson: () => string;
  /** Returns the number of entries imported, or 0 when the file held none. */
  importJson: (json: string) => Promise<number>;
  resetToSample: () => void;
}

const MediaContext = createContext<MediaStore | null>(null);

export function MediaProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    mediaRepository.list().then((list) => {
      if (cancelled) return;
      setItems(list);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const get = useCallback((id: string) => items.find((i) => i.id === id), [items]);

  const save = useCallback((item: MediaItem) => {
    const stamped = { ...item, updatedAt: new Date().toISOString() } as MediaItem;
    setItems((prev) => {
      const exists = prev.some((i) => i.id === stamped.id);
      return exists ? prev.map((i) => (i.id === stamped.id ? stamped : i)) : [stamped, ...prev];
    });
    void mediaRepository.save(stamped);
  }, []);

  const remove = useCallback(
    (id: string) => {
      const removed = items.find((i) => i.id === id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      void mediaRepository.remove(id);
      return removed;
    },
    [items],
  );

  const exportJson = useCallback(() => JSON.stringify(items, null, 2), [items]);

  const importJson = useCallback(async (json: string) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return 0;
    }
    const list = normalizeList(parsed);
    if (list.length === 0) return 0;
    setItems(list);
    await mediaRepository.replaceAll(list);
    return list.length;
  }, []);

  const resetToSample = useCallback(() => {
    const sample = mediaRepository.sample();
    setItems(sample);
    void mediaRepository.replaceAll(sample);
  }, []);

  const value = useMemo(
    () => ({ items, ready, get, save, remove, exportJson, importJson, resetToSample }),
    [items, ready, get, save, remove, exportJson, importJson, resetToSample],
  );

  return <MediaContext value={value}>{children}</MediaContext>;
}

export function useMedia(): MediaStore {
  const ctx = use(MediaContext);
  if (!ctx) throw new Error("useMedia must be used inside <MediaProvider>");
  return ctx;
}
