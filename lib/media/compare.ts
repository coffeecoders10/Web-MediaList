import { allGenres } from "./filters";
import { computeStats, type CollectionStats } from "./stats";
import { CATEGORIES, CATEGORY_LABEL, type Category, type MediaItem } from "./types";

/** One measure, both people's values. A rating of 0 means "no ratings" and is shown as a dash. */
export interface Measure {
  key: string;
  label: string;
  you: number;
  them: number;
  /** Formats a value for display; defaults to a plain number. */
  format?: "number" | "percent" | "rating";
  /** What each value is out of, shown quietly beside it: completed of total within a type. */
  youOf?: number;
  themOf?: number;
}

export interface SharedTitle {
  item: MediaItem;
  yourRating: number | null;
  theirRating: number | null;
}

export interface Comparison {
  you: CollectionStats;
  them: CollectionStats;
  measures: Measure[];
  byType: Measure[];
  shared: SharedTitle[];
  /** Mean gap, in rating points, over shared titles both rated; null when there are none. */
  ratingGap: number | null;
  /** Shared titles both rated, within a point of each other. */
  agreed: number;
  bothRated: number;
  onlyThem: MediaItem[];
  onlyYouCount: number;
  /** Genres in both people's top lists, most-read first. */
  sharedGenres: { name: string; you: number; them: number }[];
}

const pct = (done: number, total: number) => (total ? Math.round((done / total) * 100) : 0);
const lastYear = (s: CollectionStats) => s.months.reduce((n, m) => n + m.total, 0);
const hours = (s: CollectionStats) => Math.round(s.movieMinutes / 60);

/**
 * Which stats are worth setting side by side? The ones that mean the same thing for both people:
 * how much they have and have finished, how generously they rate, how much they take in, and the
 * titles and genres they have in common (the shared catalog makes a title the same title for both).
 */
export function compareLibraries(mine: MediaItem[], theirs: MediaItem[], now: Date): Comparison {
  const you = computeStats(mine, now);
  const them = computeStats(theirs, now);

  const measures: Measure[] = [
    { key: "titles", label: "Titles", you: you.total, them: them.total },
    { key: "completed", label: "Completed", you: you.byStatus.completed, them: them.byStatus.completed },
    {
      key: "rate",
      label: "Completion rate",
      you: pct(you.byStatus.completed, you.total),
      them: pct(them.byStatus.completed, them.total),
      format: "percent",
    },
    { key: "rating", label: "Average rating", you: you.averageRating ?? 0, them: them.averageRating ?? 0, format: "rating" },
    { key: "year", label: "Finished in 12 months", you: lastYear(you), them: lastYear(them) },
    { key: "chapters", label: "Chapters read", you: you.chaptersRead, them: them.chaptersRead },
    { key: "hours", label: "Hours of film", you: hours(you), them: hours(them) },
    { key: "seasons", label: "Seasons watched", you: you.seasonsWatched, them: them.seasonsWatched },
  ];

  const byType: Measure[] = CATEGORIES.map((c: Category) => ({
    key: c,
    label: CATEGORY_LABEL[c].plural,
    you: you.completedByCategory[c],
    them: them.completedByCategory[c],
    youOf: you.byCategory[c],
    themOf: them.byCategory[c],
  }));

  const theirsById = new Map(theirs.map((i) => [i.id, i]));
  const myIds = new Set(mine.map((i) => i.id));
  const shared: SharedTitle[] = mine.flatMap((item) => {
    const other = theirsById.get(item.id);
    return other ? [{ item: other, yourRating: item.rating, theirRating: other.rating }] : [];
  });
  const rated = shared.filter((s) => s.yourRating !== null && s.theirRating !== null);
  const gaps = rated.map((s) => Math.abs((s.yourRating as number) - (s.theirRating as number)));

  const mineGenres = new Map(allGenres(mine).map((g) => [g.name, g.count]));
  const sharedGenres = allGenres(theirs)
    .filter((g) => mineGenres.has(g.name))
    .map((g) => ({ name: g.name, you: mineGenres.get(g.name) ?? 0, them: g.count }))
    .sort((a, b) => b.you + b.them - (a.you + a.them))
    .slice(0, 8);

  return {
    you,
    them,
    measures,
    byType,
    shared,
    ratingGap: gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null,
    agreed: gaps.filter((g) => g <= 1).length,
    bothRated: rated.length,
    onlyThem: theirs.filter((i) => !myIds.has(i.id)),
    onlyYouCount: mine.filter((i) => !theirsById.has(i.id)).length,
    sharedGenres,
  };
}
