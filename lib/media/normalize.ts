import {
  ART_PATTERNS,
  isCategory,
  isStatus,
  isTrackingMode,
  type ArtPattern,
  type CoverArt,
  type MediaItem,
} from "./types";

type Raw = Record<string, unknown>;

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v.trim() : fallback);
const count = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const countOrNull = (v: unknown): number | null => (count(v) > 0 ? count(v) : null);
/** A count that can't exceed `max` when the total is known. */
const upTo = (v: unknown, max: number | null): number => (max ? Math.min(count(v), max) : count(v));
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
      const chaptersTotal = countOrNull(raw.chaptersTotal);
      return {
        ...base,
        category: "book",
        chaptersTotal,
        chaptersRead: upTo(raw.chaptersRead, chaptersTotal),
        series: s && str(s.name) ? { name: str(s.name), volume: countOrNull(s.volume) } : null,
      };
    }
    case "movie":
      return { ...base, category: "movie", type: str(raw.type), runtimeMinutes: countOrNull(raw.runtimeMinutes) };
    case "series": {
      const totalSeasons = countOrNull(raw.totalSeasons);
      return { ...base, category: "series", totalSeasons, currentSeason: upTo(raw.currentSeason, totalSeasons) };
    }
    default: {
      const totalSeasons = countOrNull(raw.totalSeasons);
      const totalEpisodes = countOrNull(raw.totalEpisodes);
      return {
        ...base,
        category: "anime",
        tracking: isTrackingMode(raw.tracking) ? raw.tracking : "seasons",
        totalSeasons,
        currentSeason: upTo(raw.currentSeason, totalSeasons),
        totalEpisodes,
        currentEpisode: upTo(raw.currentEpisode, totalEpisodes),
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
