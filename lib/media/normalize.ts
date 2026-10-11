import {
  ART_PATTERNS,
  isCategory,
  isStatus,
  type ArtPattern,
  type CoverArt,
  type MediaItem,
} from "./types";

type Raw = Record<string, unknown>;

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v.trim() : fallback);
const count = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const countOrNull = (v: unknown): number | null => (count(v) > 0 ? count(v) : null);
const dateOrNull = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.map((g) => str(g)).filter(Boolean))] : [];

function art(v: unknown): CoverArt | undefined {
  if (!v || typeof v !== "object") return undefined;
  const { hue, pattern } = v as Raw;
  if (typeof hue !== "number" || !(ART_PATTERNS as readonly string[]).includes(pattern as string)) return undefined;
  return { hue: ((hue % 360) + 360) % 360, pattern: pattern as ArtPattern };
}

/**
 * Validates untrusted data (seed file, legacy localStorage, imports, client requests) and fills in defaults.
 * Returns null when the record cannot be recovered into a usable entry.
 */
export function normalizeItem(input: unknown): MediaItem | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Raw;
  const id = str(raw.id);
  const title = str(raw.title);
  if (!id || !title || !isCategory(raw.category)) return null;

  const rating =
    typeof raw.rating === "number" && raw.rating > 0 ? Math.min(10, Math.round(raw.rating * 2) / 2) : null;
  const today = () => new Date().toISOString().slice(0, 10);

  const base = {
    id,
    catalogId: count(raw.catalogId),
    title,
    creator: str(raw.creator),
    year: countOrNull(raw.year),
    status: isStatus(raw.status) ? raw.status : ("planned" as const),
    rating,
    genres: strings(raw.genres),
    tags: strings(raw.tags),
    synopsis: str(raw.synopsis),
    notes: str(raw.notes),
    posterUrl: str(raw.posterUrl),
    art: art(raw.art),
    addedAt: dateOrNull(raw.addedAt) ?? today(),
    startedAt: dateOrNull(raw.startedAt),
    finishedAt: dateOrNull(raw.finishedAt),
    updatedAt: str(raw.updatedAt) || `${dateOrNull(raw.addedAt) ?? today()}T00:00:00.000Z`,
  };

  switch (raw.category) {
    case "book": {
      const s = raw.series as Raw | null | undefined;
      const pagesTotal = countOrNull(raw.pagesTotal);
      const chaptersTotal = countOrNull(raw.chaptersTotal);
      return {
        ...base,
        category: "book",
        pagesTotal,
        pagesRead: pagesTotal ? Math.min(count(raw.pagesRead), pagesTotal) : count(raw.pagesRead),
        chaptersTotal,
        chaptersRead: chaptersTotal ? Math.min(count(raw.chaptersRead), chaptersTotal) : count(raw.chaptersRead),
        series: s && str(s.name) ? { name: str(s.name), volume: Math.max(1, count(s.volume)), of: countOrNull(s.of) } : null,
      };
    }
    case "movie":
      return { ...base, category: "movie", runtimeMinutes: countOrNull(raw.runtimeMinutes) };
    default: {
      const seasons = Array.isArray(raw.seasons) ? raw.seasons.map(count).filter((n) => n > 0) : [];
      const total = seasons.reduce((a, b) => a + b, 0);
      return {
        ...base,
        category: raw.category as "series" | "anime",
        seasons,
        watchedEpisodes: Math.min(count(raw.watchedEpisodes), total),
      };
    }
  }
}

export function normalizeList(input: unknown): MediaItem[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: MediaItem[] = [];
  for (const entry of input) {
    const item = normalizeItem(entry);
    if (item && !seen.has(item.id)) {
      seen.add(item.id);
      out.push(item);
    }
  }
  return out;
}
