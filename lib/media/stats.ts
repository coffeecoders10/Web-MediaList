import { allGenres } from "./filters";
import { CATEGORIES, STATUSES, type Category, type MediaItem, type Status } from "./types";

export interface MonthBucket {
  /** yyyy-mm */
  key: string;
  label: string;
  counts: Record<Category, number>;
  total: number;
}

export interface RatingBin {
  /** Lower bound of the bin; the first bin collects everything at or below 4.5. */
  value: number;
  count: number;
}

export interface CollectionStats {
  total: number;
  byStatus: Record<Status, number>;
  byCategory: Record<Category, number>;
  /** Completed entries per category, for completion rate. */
  completedByCategory: Record<Category, number>;
  rated: number;
  averageRating: number | null;
  ratingBins: RatingBin[];
  topGenres: { name: string; count: number }[];
  pagesRead: number;
  movieMinutes: number;
  episodesWatched: number;
  months: MonthBucket[];
  recentlyFinished: MediaItem[];
}

const zeroByCategory = () => Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
const zeroByStatus = () => Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;

const RATING_BINS = [4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

/** `now` is passed in so this stays a pure function and never reads the clock during prerender. */
export function computeStats(items: MediaItem[], now: Date, monthsBack = 12): CollectionStats {
  const byStatus = zeroByStatus();
  const byCategory = zeroByCategory();
  const completedByCategory = zeroByCategory();
  const bins = new Map(RATING_BINS.map((v) => [v, 0]));
  let ratingSum = 0;
  let rated = 0;
  let pagesRead = 0;
  let movieMinutes = 0;
  let episodesWatched = 0;

  const months: MonthBucket[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push({
      key: d.toISOString().slice(0, 7),
      label: d.toLocaleString("en", { month: "short", timeZone: "UTC" }),
      counts: zeroByCategory(),
      total: 0,
    });
  }
  const monthByKey = new Map(months.map((m) => [m.key, m]));

  for (const item of items) {
    byStatus[item.status]++;
    byCategory[item.category]++;
    if (item.status === "completed") completedByCategory[item.category]++;

    if (item.rating !== null) {
      rated++;
      ratingSum += item.rating;
      const bin = Math.max(4.5, item.rating);
      bins.set(bin, (bins.get(bin) ?? 0) + 1);
    }

    if (item.category === "book") pagesRead += item.pagesRead;
    else if (item.category === "movie") {
      if (item.status === "completed") movieMinutes += item.runtimeMinutes ?? 0;
    } else episodesWatched += item.watchedEpisodes;

    const month = item.finishedAt ? monthByKey.get(item.finishedAt.slice(0, 7)) : undefined;
    if (month) {
      month.counts[item.category]++;
      month.total++;
    }
  }

  return {
    total: items.length,
    byStatus,
    byCategory,
    completedByCategory,
    rated,
    averageRating: rated ? ratingSum / rated : null,
    ratingBins: RATING_BINS.map((value) => ({ value, count: bins.get(value) ?? 0 })),
    topGenres: allGenres(items).slice(0, 8),
    pagesRead,
    movieMinutes,
    episodesWatched,
    months,
    recentlyFinished: items
      .filter((i) => i.finishedAt)
      .sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""))
      .slice(0, 6),
  };
}
