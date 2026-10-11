import seed from "./seed.json";
import { normalizeList } from "./normalize";
import type { MediaItem } from "./types";

/**
 * The only thing the UI knows about persistence. To move to a database, implement this
 * interface against an API or ORM and swap the instance exported at the bottom of this file.
 */
export interface MediaRepository {
  list(): Promise<MediaItem[]>;
  save(item: MediaItem): Promise<void>;
  remove(id: string): Promise<void>;
  /** Replaces the whole collection (used by import and reset). */
  replaceAll(items: MediaItem[]): Promise<void>;
  /** The untouched sample collection. */
  sample(): MediaItem[];
}

const STORAGE_KEY = "lightbox:collection:v1";

function readStorage(): MediaItem[] | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === null) return null;
    return normalizeList(JSON.parse(stored));
  } catch {
    return null;
  }
}

function writeStorage(items: MediaItem[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage can be full or blocked (private mode); the in-memory state still works for this session.
  }
}

/**
 * Seeds from the bundled JSON file and keeps every edit in localStorage.
 * The JSON file itself is never written to.
 */
class LocalMediaRepository implements MediaRepository {
  sample() {
    return normalizeList(seed);
  }

  async list() {
    return readStorage() ?? this.sample();
  }

  async save(item: MediaItem) {
    const items = await this.list();
    const index = items.findIndex((i) => i.id === item.id);
    if (index === -1) items.unshift(item);
    else items[index] = item;
    writeStorage(items);
  }

  async remove(id: string) {
    writeStorage((await this.list()).filter((i) => i.id !== id));
  }

  async replaceAll(items: MediaItem[]) {
    writeStorage(items);
  }
}

export const mediaRepository: MediaRepository = new LocalMediaRepository();
