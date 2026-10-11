import type { Book, Episodic, MediaItem, Status } from "./types";

export interface Progress {
  done: number;
  total: number;
  /** 0–1 */
  fraction: number;
  /** Short human label, e.g. "311 / 662 pages". */
  label: string;
}

const today = () => new Date().toISOString().slice(0, 10);

export const totalEpisodes = (item: Episodic) => item.seasons.reduce((a, b) => a + b, 0);

function make(done: number, total: number, unit: string): Progress {
  return { done, total, fraction: total > 0 ? Math.min(1, done / total) : 0, label: `${done} / ${total} ${unit}` };
}

/** The measurable progress for an entry, or null when it has none (movies, unmeasured books). */
export function getProgress(item: MediaItem): Progress | null {
  switch (item.category) {
    case "book":
      if (item.pagesTotal) return make(item.pagesRead, item.pagesTotal, "pages");
      if (item.chaptersTotal) return make(item.chaptersRead, item.chaptersTotal, "chapters");
      return null;
    case "movie":
      return null;
    default: {
      const total = totalEpisodes(item);
      return total > 0 ? make(item.watchedEpisodes, total, "episodes") : null;
    }
  }
}

/** Season and episode of the last watched episode (1-based), or null before the first. */
export function episodePosition(item: Episodic): { season: number; episode: number } | null {
  let remaining = item.watchedEpisodes;
  for (let i = 0; i < item.seasons.length; i++) {
    if (remaining <= item.seasons[i]) return remaining > 0 ? { season: i + 1, episode: remaining } : null;
    remaining -= item.seasons[i];
  }
  return null;
}

/** Short position label shown on cards and in the detail header, e.g. "S2 E4" or "Ep 19". */
export function positionLabel(item: MediaItem): string | null {
  if (item.category === "series" || item.category === "anime") {
    const pos = episodePosition(item);
    if (!pos) return null;
    return item.seasons.length > 1 ? `S${pos.season} E${pos.episode}` : `Ep ${pos.episode}`;
  }
  if (item.category === "book") {
    if (item.pagesTotal) return `p. ${item.pagesRead}`;
    if (item.chaptersTotal) return `Ch. ${item.chaptersRead}`;
  }
  return null;
}

function withFullProgress(item: MediaItem): MediaItem {
  switch (item.category) {
    case "book":
      return {
        ...item,
        pagesRead: item.pagesTotal ?? item.pagesRead,
        chaptersRead: item.chaptersTotal ?? item.chaptersRead,
      };
    case "movie":
      return item;
    default:
      return { ...item, watchedEpisodes: totalEpisodes(item) };
  }
}

/**
 * Keeps status, progress and dates consistent after an edit:
 * - Completed means fully consumed and has a finish date.
 * - In progress has a start date.
 * - Only Completed entries carry a finish date.
 */
export function reconcile(item: MediaItem): MediaItem {
  let next: MediaItem = item;
  if (next.status === "completed") {
    next = withFullProgress(next);
    next = { ...next, finishedAt: next.finishedAt ?? today(), startedAt: next.startedAt ?? next.finishedAt ?? today() };
  } else {
    next = { ...next, finishedAt: null };
    if (next.status === "in-progress" && !next.startedAt) next = { ...next, startedAt: today() };
  }
  return next;
}

function afterProgress(item: MediaItem, done: number, total: number | null): MediaItem {
  let status: Status = item.status;
  if (total && done >= total) status = "completed";
  else if (done > 0 && (status === "planned" || status === "completed")) status = "in-progress";
  else if (done === 0 && status === "in-progress") status = "planned";
  return reconcile({ ...item, status });
}

export function setPagesRead(book: Book, pages: number): Book {
  const read = Math.max(0, Math.min(pages, book.pagesTotal ?? pages));
  return afterProgress({ ...book, pagesRead: read }, read, book.pagesTotal) as Book;
}

export function setChaptersRead(book: Book, chapters: number): Book {
  const read = Math.max(0, Math.min(chapters, book.chaptersTotal ?? chapters));
  // Chapters drive status only when pages are not tracked.
  if (book.pagesTotal) return { ...book, chaptersRead: read };
  return afterProgress({ ...book, chaptersRead: read }, read, book.chaptersTotal) as Book;
}

export function setWatchedEpisodes(item: Episodic, watched: number): Episodic {
  const total = totalEpisodes(item);
  const value = Math.max(0, Math.min(watched, total));
  return afterProgress({ ...item, watchedEpisodes: value }, value, total) as Episodic;
}

export function setStatus(item: MediaItem, status: Status): MediaItem {
  return reconcile({ ...item, status });
}

/** The one-tap "I just read/watched a bit more" action for an entry, if it has measurable progress. */
export function quickStep(item: MediaItem): { label: string; apply: () => MediaItem } | null {
  if (item.status === "completed" || item.status === "dropped") return null;
  switch (item.category) {
    case "movie":
      return null;
    case "book":
      if (item.chaptersTotal && !item.pagesTotal) {
        return { label: "+1 chapter", apply: () => setChaptersRead(item, item.chaptersRead + 1) };
      }
      return item.pagesTotal ? { label: "+10 pages", apply: () => setPagesRead(item, item.pagesRead + 10) } : null;
    default:
      return totalEpisodes(item) > 0
        ? { label: "+1 episode", apply: () => setWatchedEpisodes(item, item.watchedEpisodes + 1) }
        : null;
  }
}
