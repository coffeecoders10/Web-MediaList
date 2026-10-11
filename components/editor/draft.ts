import { newId } from "@/lib/media/art";
import { reconcile } from "@/lib/media/progress";
import type { Category, MediaItem, Status } from "@/lib/media/types";

/** Form state: everything is text so half-typed numbers never fight the inputs. */
export interface Draft {
  category: Category;
  title: string;
  creator: string;
  year: string;
  status: Status;
  rating: number | null;
  genres: string[];
  synopsis: string;
  notes: string;
  posterUrl: string;
  startedAt: string;
  finishedAt: string;
  // Books
  pagesTotal: string;
  pagesRead: string;
  chaptersTotal: string;
  chaptersRead: string;
  seriesName: string;
  seriesVolume: string;
  seriesOf: string;
  // Movies
  runtimeMinutes: string;
  // Series and anime
  seasons: string[];
  watchedEpisodes: string;
}

export type DraftErrors = Partial<Record<keyof Draft | "seasons", string>>;

const text = (n: number | null | undefined) => (n ? String(n) : "");

export function emptyDraft(category: Category = "book"): Draft {
  return {
    category,
    title: "",
    creator: "",
    year: "",
    status: "planned",
    rating: null,
    genres: [],
    synopsis: "",
    notes: "",
    posterUrl: "",
    startedAt: "",
    finishedAt: "",
    pagesTotal: "",
    pagesRead: "",
    chaptersTotal: "",
    chaptersRead: "",
    seriesName: "",
    seriesVolume: "",
    seriesOf: "",
    runtimeMinutes: "",
    seasons: [""],
    watchedEpisodes: "",
  };
}

export function toDraft(item: MediaItem): Draft {
  const draft: Draft = {
    ...emptyDraft(item.category),
    title: item.title,
    creator: item.creator,
    year: text(item.year),
    status: item.status,
    rating: item.rating,
    genres: item.genres,
    synopsis: item.synopsis,
    notes: item.notes,
    posterUrl: item.posterUrl,
    startedAt: item.startedAt ?? "",
    finishedAt: item.finishedAt ?? "",
  };
  switch (item.category) {
    case "book":
      return {
        ...draft,
        pagesTotal: text(item.pagesTotal),
        pagesRead: text(item.pagesRead),
        chaptersTotal: text(item.chaptersTotal),
        chaptersRead: text(item.chaptersRead),
        seriesName: item.series?.name ?? "",
        seriesVolume: text(item.series?.volume),
        seriesOf: text(item.series?.of),
      };
    case "movie":
      return { ...draft, runtimeMinutes: text(item.runtimeMinutes) };
    default:
      return { ...draft, seasons: item.seasons.map(String), watchedEpisodes: text(item.watchedEpisodes) };
  }
}

const isBlank = (s: string) => s.trim() === "";
const isWhole = (s: string) => /^\d+$/.test(s.trim());
const num = (s: string) => (isBlank(s) ? 0 : Number(s));

export function validate(d: Draft): DraftErrors {
  const e: DraftErrors = {};
  if (isBlank(d.title)) e.title = "Add a title so you can find this later.";
  if (!isBlank(d.year) && (!isWhole(d.year) || num(d.year) < 1000 || num(d.year) > 2100)) e.year = "Enter a four-digit year.";
  if (!isBlank(d.posterUrl) && !/^https?:\/\/\S+$/i.test(d.posterUrl.trim())) e.posterUrl = "Use a link that starts with http:// or https://.";
  if (d.startedAt && d.finishedAt && d.finishedAt < d.startedAt) e.finishedAt = "The finish date comes before the start date.";

  const whole = (key: keyof Draft, label: string) => {
    const v = d[key] as string;
    if (!isBlank(v) && !isWhole(v)) e[key] = `${label} must be a whole number.`;
  };

  if (d.category === "book") {
    whole("pagesTotal", "Page count");
    whole("pagesRead", "Pages read");
    whole("chaptersTotal", "Chapter count");
    whole("chaptersRead", "Chapters read");
    whole("seriesVolume", "Volume");
    whole("seriesOf", "Volumes in series");
    if (!e.pagesRead && !e.pagesTotal && num(d.pagesTotal) > 0 && num(d.pagesRead) > num(d.pagesTotal)) e.pagesRead = "That's more than the page count.";
    if (!e.chaptersRead && !e.chaptersTotal && num(d.chaptersTotal) > 0 && num(d.chaptersRead) > num(d.chaptersTotal)) e.chaptersRead = "That's more than the chapter count.";
  } else if (d.category === "movie") {
    whole("runtimeMinutes", "Runtime");
  } else {
    const seasons = d.seasons.map((s) => s.trim());
    if (seasons.some((s) => !isWhole(s) || Number(s) < 1)) e.seasons = "Give every season at least one episode, or remove it.";
    else if (!isBlank(d.watchedEpisodes) && !isWhole(d.watchedEpisodes)) e.watchedEpisodes = "Episodes watched must be a whole number.";
    else if (num(d.watchedEpisodes) > seasons.reduce((a, s) => a + Number(s), 0)) e.watchedEpisodes = "That's more than the total episodes.";
  }
  return e;
}

/** Builds the stored entry from a validated draft; `base` supplies id and dates when editing. */
export function fromDraft(d: Draft, base: MediaItem | null): MediaItem {
  const now = new Date().toISOString();
  const common = {
    id: base?.id ?? newId(d.title),
    title: d.title.trim(),
    creator: d.creator.trim(),
    year: isBlank(d.year) ? null : Number(d.year),
    status: d.status,
    rating: d.rating,
    genres: d.genres,
    synopsis: d.synopsis.trim(),
    notes: d.notes.trim(),
    posterUrl: d.posterUrl.trim(),
    art: base?.art,
    addedAt: base?.addedAt ?? now.slice(0, 10),
    startedAt: d.startedAt || null,
    finishedAt: d.finishedAt || null,
    updatedAt: now,
  };

  let item: MediaItem;
  if (d.category === "book") {
    item = {
      ...common,
      category: "book",
      pagesTotal: num(d.pagesTotal) || null,
      pagesRead: num(d.pagesRead),
      chaptersTotal: num(d.chaptersTotal) || null,
      chaptersRead: num(d.chaptersRead),
      series: isBlank(d.seriesName) ? null : { name: d.seriesName.trim(), volume: num(d.seriesVolume) || 1, of: num(d.seriesOf) || null },
    };
  } else if (d.category === "movie") {
    item = { ...common, category: "movie", runtimeMinutes: num(d.runtimeMinutes) || null };
  } else {
    item = { ...common, category: d.category, seasons: d.seasons.map(Number), watchedEpisodes: num(d.watchedEpisodes) };
  }
  return reconcile(item);
}
