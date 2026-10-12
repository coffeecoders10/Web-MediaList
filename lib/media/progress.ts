import type { MediaItem, Status } from "./types";

/** What an entry is counted in: books by chapter, TV by season, anime by season or episode. */
export type Unit = "chapter" | "season" | "episode";

export const UNIT_LABEL: Record<Unit, { singular: string; plural: string }> = {
  chapter: { singular: "Chapter", plural: "Chapters" },
  season: { singular: "Season", plural: "Seasons" },
  episode: { singular: "Episode", plural: "Episodes" },
};

/** Where an entry is in whatever it is counted in. `total` is null when it isn't known. */
export interface Tracker {
  unit: Unit;
  current: number;
  total: number | null;
}

/** The one thing progress is measured in for this entry, or null when it has none (movies). */
export function trackerOf(item: MediaItem): Tracker | null {
  switch (item.category) {
    case "book":
      return { unit: "chapter", current: item.chaptersRead, total: item.chaptersTotal };
    case "series":
      return { unit: "season", current: item.currentSeason, total: item.totalSeasons };
    case "anime":
      return item.tracking === "episodes"
        ? { unit: "episode", current: item.currentEpisode, total: item.totalEpisodes }
        : { unit: "season", current: item.currentSeason, total: item.totalSeasons };
    default:
      return null;
  }
}

export interface Progress {
  done: number;
  /** Null when the total isn't known: there is a position to show but nothing to measure it against. */
  total: number | null;
  /** 0–1, or null without a total. */
  fraction: number | null;
  /** Short human label, e.g. "3 / 5 Seasons", or "Chapter 12" without a total. */
  label: string;
}

const today = () => new Date().toISOString().slice(0, 10);

/** The measurable progress for an entry, or null when there is nothing to show yet. */
export function getProgress(item: MediaItem): Progress | null {
  const tracker = trackerOf(item);
  if (!tracker) return null;
  const { unit, current, total } = tracker;
  if (total) {
    return { done: current, total, fraction: Math.min(1, current / total), label: `${current} / ${total} ${UNIT_LABEL[unit].plural}` };
  }
  return current > 0 ? { done: current, total: null, fraction: null, label: `${UNIT_LABEL[unit].singular} ${current}` } : null;
}

/** Writes the count for whatever the entry is tracked in. Only the unit being tracked changes. */
function withCurrent(item: MediaItem, value: number): MediaItem {
  switch (item.category) {
    case "book":
      return { ...item, chaptersRead: value };
    case "series":
      return { ...item, currentSeason: value };
    case "anime":
      return item.tracking === "episodes" ? { ...item, currentEpisode: value } : { ...item, currentSeason: value };
    default:
      return item;
  }
}

/** Completed means everything has been taken in, as far as the totals are known. */
function withFullProgress(item: MediaItem): MediaItem {
  const tracker = trackerOf(item);
  return tracker?.total ? withCurrent(item, tracker.total) : item;
}

/**
 * Keeps status and progress consistent after an edit, without inventing anything the user didn't enter:
 * - Completed means fully consumed (when the total is known).
 * - Only Completed entries carry a finish date.
 */
export function reconcile(item: MediaItem): MediaItem {
  if (item.status === "completed") return withFullProgress(item);
  return item.finishedAt ? { ...item, finishedAt: null } : item;
}

/** For one-tap actions: moving to Completed or In progress also stamps today, unless a date is already set. */
function stampDates(item: MediaItem): MediaItem {
  if (item.status === "completed") {
    const finishedAt = item.finishedAt ?? today();
    return { ...item, finishedAt, startedAt: item.startedAt ?? finishedAt };
  }
  return item.status === "in-progress" && !item.startedAt ? { ...item, startedAt: today() } : item;
}

export function setStatus(item: MediaItem, status: Status): MediaItem {
  return stampDates(reconcile({ ...item, status }));
}

/** Moves the count to `value` (clamped to the total) and lets status follow: finishing completes, starting begins. */
export function setCurrent(item: MediaItem, value: number): MediaItem {
  const tracker = trackerOf(item);
  if (!tracker) return item;
  const current = Math.max(0, tracker.total ? Math.min(value, tracker.total) : value);
  let status: Status = item.status;
  if (tracker.total && current >= tracker.total) status = "completed";
  else if (current > 0 && (status === "planned" || status === "completed")) status = "in-progress";
  else if (current === 0 && status === "in-progress") status = "planned";
  return setStatus(withCurrent(item, current), status);
}

/** The one-tap "I just read/watched a bit more" action for an entry, if it can be counted. */
export function quickStep(item: MediaItem): { label: string; apply: () => MediaItem } | null {
  const tracker = trackerOf(item);
  if (!tracker || item.status === "completed" || item.status === "dropped") return null;
  if (tracker.total !== null && tracker.current >= tracker.total) return null;
  return { label: `+1 ${UNIT_LABEL[tracker.unit].singular.toLowerCase()}`, apply: () => setCurrent(item, tracker.current + 1) };
}
