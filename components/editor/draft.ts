import { newId } from "@/lib/media/art";
import { reconcile } from "@/lib/media/progress";
import type { Category, CoverArt, MediaItem, Status, TrackingMode } from "@/lib/media/types";

/** Form state: everything is text so half-typed numbers never fight the inputs. */
export interface Draft {
  category: Category;
  /** The shared catalog entry this form was filled from, or null for a title typed from scratch. */
  catalogId: number | null;
  title: string;
  creator: string;
  year: string;
  status: Status;
  rating: number | null;
  genres: string[];
  synopsis: string;
  notes: string;
  posterUrl: string;
  /** Generated cover, carried along so a title picked from the catalog keeps the cover it already has. */
  art: CoverArt | undefined;
  startedAt: string;
  finishedAt: string;
  // Books and movies: the series (or franchise) and the volume (or part) within it
  seriesName: string;
  seriesVolume: string;
  // Books
  chaptersTotal: string;
  chaptersRead: string;
  // Movies
  type: string;
  runtimeMinutes: string;
  // Series and anime
  totalSeasons: string;
  currentSeason: string;
  // Anime
  tracking: TrackingMode;
  totalEpisodes: string;
  currentEpisode: string;
}

export type DraftErrors = Partial<Record<keyof Draft, string>>;

/** The draft fields that hold text, which is what inputs bind to. */
export type TextKey = { [K in keyof Draft]: Draft[K] extends string ? K : never }[keyof Draft];

const text = (n: number | null | undefined) => (n ? String(n) : "");

export function emptyDraft(category: Category = "book"): Draft {
  return {
    category,
    catalogId: null,
    title: "",
    creator: "",
    year: "",
    status: "planned",
    rating: null,
    genres: [],
    synopsis: "",
    notes: "",
    posterUrl: "",
    art: undefined,
    startedAt: "",
    finishedAt: "",
    chaptersTotal: "",
    chaptersRead: "",
    seriesName: "",
    seriesVolume: "",
    type: "",
    runtimeMinutes: "",
    totalSeasons: "",
    currentSeason: "",
    tracking: "seasons",
    totalEpisodes: "",
    currentEpisode: "",
  };
}

/** The category-specific fields of an item, in draft form. */
function specifics(item: MediaItem): Partial<Draft> {
  switch (item.category) {
    case "book":
      return {
        chaptersTotal: text(item.chaptersTotal),
        chaptersRead: text(item.chaptersRead),
        seriesName: item.series?.name ?? "",
        seriesVolume: text(item.series?.volume),
      };
    case "movie":
      return {
        type: item.type,
        runtimeMinutes: text(item.runtimeMinutes),
        seriesName: item.series?.name ?? "",
        seriesVolume: text(item.series?.volume),
      };
    case "series":
      return { totalSeasons: text(item.totalSeasons), currentSeason: text(item.currentSeason) };
    case "anime":
      return {
        tracking: item.tracking,
        totalSeasons: text(item.totalSeasons),
        currentSeason: text(item.currentSeason),
        totalEpisodes: text(item.totalEpisodes),
        currentEpisode: text(item.currentEpisode),
      };
  }
}

export function toDraft(item: MediaItem): Draft {
  return {
    ...emptyDraft(item.category),
    catalogId: item.catalogId > 0 ? item.catalogId : null,
    title: item.title,
    creator: item.creator,
    year: text(item.year),
    status: item.status,
    rating: item.rating,
    genres: item.genres,
    synopsis: item.synopsis,
    notes: item.notes,
    posterUrl: item.posterUrl,
    art: item.art,
    startedAt: item.startedAt ?? "",
    finishedAt: item.finishedAt ?? "",
    ...specifics(item),
  };
}

/**
 * Fills the draft from a shared catalog title. Only facts about the work are copied (title, creator,
 * genres, totals, series, cover...), and only where the catalog has a value, so anything already typed
 * is kept when the catalog is silent. Status, progress, rating, notes and dates are never touched.
 */
export function applyCatalogItem(draft: Draft, item: MediaItem): Draft {
  const shared = specifics(item);
  const patch: Partial<Draft> = { catalogId: item.catalogId, title: item.title };

  const fillText = (key: TextKey, value: string | undefined) => {
    if (value) Object.assign(patch, { [key]: value });
  };
  fillText("creator", item.creator);
  fillText("year", text(item.year));
  fillText("synopsis", item.synopsis);
  fillText("posterUrl", item.posterUrl);
  if (item.genres.length) patch.genres = item.genres;
  if (item.art) patch.art = item.art;

  // Totals and series describe the work; positions (chapters read, current season...) are the user's own.
  const totals: TextKey[] = ["chaptersTotal", "seriesName", "seriesVolume", "type", "runtimeMinutes", "totalSeasons", "totalEpisodes"];
  for (const key of totals) fillText(key, shared[key as keyof typeof shared] as string | undefined);

  // Anime counts by whichever mode the catalog knows a total for.
  if (item.category === "anime" && item.totalEpisodes && !item.totalSeasons) patch.tracking = "episodes";
  if (item.category === "anime" && item.totalSeasons && !item.totalEpisodes) patch.tracking = "seasons";
  return { ...draft, ...patch };
}

const isBlank = (s: string) => s.trim() === "";
const isWhole = (s: string) => /^\d+$/.test(s.trim());
const num = (s: string) => (isBlank(s) ? 0 : Number(s));

export function validate(d: Draft): DraftErrors {
  const e: DraftErrors = {};
  // The title is the only thing a record can't do without.
  if (isBlank(d.title)) e.title = "Add a title so you can find this later.";
  if (!isBlank(d.year) && (!isWhole(d.year) || num(d.year) < 1000 || num(d.year) > 2100)) e.year = "Enter a four-digit year.";
  if (!isBlank(d.posterUrl) && !/^https?:\/\/\S+$/i.test(d.posterUrl.trim())) e.posterUrl = "Use a link that starts with http:// or https://.";
  if (d.startedAt && d.finishedAt && d.status === "completed" && d.finishedAt < d.startedAt) e.finishedAt = "The finish date comes before the start date.";

  const whole = (key: TextKey, label: string) => {
    if (!isBlank(d[key]) && !isWhole(d[key])) e[key] = `${label} must be a whole number.`;
  };
  /** A position can't pass a known total. */
  const within = (current: TextKey, total: TextKey, noun: string) => {
    if (!e[current] && !e[total] && num(d[total]) > 0 && num(d[current]) > num(d[total])) e[current] = `That's more than the ${noun} total.`;
  };

  switch (d.category) {
    case "book":
      whole("chaptersTotal", "Total chapters");
      whole("chaptersRead", "Chapters read");
      whole("seriesVolume", "Volume");
      within("chaptersRead", "chaptersTotal", "chapter");
      break;
    case "movie":
      whole("runtimeMinutes", "Runtime");
      whole("seriesVolume", "Part");
      break;
    case "series":
      whole("totalSeasons", "Total seasons");
      whole("currentSeason", "Current season");
      within("currentSeason", "totalSeasons", "season");
      break;
    case "anime":
      // Only the mode in use is checked; the other pair is not on screen.
      if (d.tracking === "seasons") {
        whole("totalSeasons", "Total seasons");
        whole("currentSeason", "Current season");
        within("currentSeason", "totalSeasons", "season");
      } else {
        whole("totalEpisodes", "Total episodes");
        whole("currentEpisode", "Current episode");
        within("currentEpisode", "totalEpisodes", "episode");
      }
      break;
  }
  return e;
}

/**
 * Builds the item from a validated draft; `base` supplies id and added date when editing. A new item gets a
 * temporary id: the server decides which shared catalog entry it becomes (the picked one, if `catalogId` is set).
 */
export function fromDraft(d: Draft, base: MediaItem | null): MediaItem {
  const now = new Date().toISOString();
  const common = {
    id: base?.id ?? newId(d.title),
    catalogId: base?.catalogId ?? d.catalogId ?? 0,
    title: d.title.trim(),
    creator: d.creator.trim(),
    year: isBlank(d.year) ? null : Number(d.year),
    status: d.status,
    rating: d.rating,
    genres: d.genres,
    synopsis: d.synopsis.trim(),
    notes: d.notes.trim(),
    posterUrl: d.posterUrl.trim(),
    art: d.art,
    addedAt: base?.addedAt ?? now.slice(0, 10),
    startedAt: d.startedAt || null,
    finishedAt: d.finishedAt || null,
    updatedAt: now,
  };

  let item: MediaItem;
  switch (d.category) {
    case "book":
      item = {
        ...common,
        category: "book",
        chaptersTotal: num(d.chaptersTotal) || null,
        chaptersRead: num(d.chaptersRead),
        series: isBlank(d.seriesName) ? null : { name: d.seriesName.trim(), volume: num(d.seriesVolume) || null },
      };
      break;
    case "movie":
      item = {
        ...common,
        category: "movie",
        type: d.type.trim(),
        runtimeMinutes: num(d.runtimeMinutes) || null,
        series: isBlank(d.seriesName) ? null : { name: d.seriesName.trim(), volume: num(d.seriesVolume) || null },
      };
      break;
    case "series":
      item = { ...common, category: "series", totalSeasons: num(d.totalSeasons) || null, currentSeason: num(d.currentSeason) };
      break;
    case "anime":
      item = {
        ...common,
        category: "anime",
        tracking: d.tracking,
        totalSeasons: num(d.totalSeasons) || null,
        currentSeason: num(d.currentSeason),
        totalEpisodes: num(d.totalEpisodes) || null,
        currentEpisode: num(d.currentEpisode),
      };
      break;
  }
  return reconcile(item);
}
