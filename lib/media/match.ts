import type { CatalogEntry } from "./model";
import type { MediaItem } from "./types";

/**
 * Duplicate detection for the shared catalog. Merging two different works (a book and its sequel,
 * a film and its remake) is worse than keeping a near-duplicate, so the rules lean strict.
 * Matching only ever happens within one category, because each category has its own catalog.
 */

/** Lowercase, accent-free, punctuation-free text, for comparing titles and names. */
export const fold = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** Comparable form of a title: no case, accents or punctuation, and no leading article. */
export const normalizeTitle = (title: string) => fold(title).replace(/^(the|a|an) (?=.)/, "");

const nameTokens = (creator: string) => new Set(fold(creator).split(" ").filter(Boolean));

type Verdict = "match" | "conflict" | "unknown";

function compareCreators(a: string, b: string): Verdict {
  const x = nameTokens(a);
  const y = nameTokens(b);
  if (x.size === 0 || y.size === 0) return "unknown";
  const [small, large] = x.size <= y.size ? [x, y] : [y, x];
  const contained = [...small].every((t) => large.has(t));
  if (contained && small.size === large.size) return "match";
  // "Frank Herbert" inside "Frank Herbert, Brian Herbert" is the same author line; a bare surname is too vague to say.
  if (contained) return small.size >= 2 ? "match" : "unknown";
  return "conflict";
}

function compareYears(a: number | null, b: number | null): Verdict {
  if (a === null || b === null) return "unknown";
  return a === b ? "match" : "conflict";
}

interface Facts {
  title: string;
  creator: string;
  year: number | null;
  volume: number | null;
}

function factsOf(source: Record<string, unknown>): Facts {
  const series = source.series as { volume?: unknown } | null | undefined;
  return {
    title: normalizeTitle(typeof source.title === "string" ? source.title : ""),
    creator: typeof source.creator === "string" ? source.creator : "",
    year: typeof source.year === "number" ? source.year : null,
    volume: typeof series?.volume === "number" ? series.volume : null,
  };
}

/**
 * Finds the catalog entry that is the same work as `item`, or null when it is new.
 *
 * - The normalized titles must be equal.
 * - Known creators, years and book volumes must not disagree.
 * - A creator or year match must back the title up. The exception is a bare title (no creator, no
 *   year): it joins an existing entry only if exactly one entry has that title.
 */
export function findMatch(item: MediaItem, entries: CatalogEntry[]): CatalogEntry | null {
  const wanted = factsOf(item as unknown as Record<string, unknown>);
  if (!wanted.title) return null;
  const bare = !wanted.creator.trim() && wanted.year === null;

  const candidates: { entry: CatalogEntry; support: number }[] = [];
  for (const entry of entries) {
    if (entry.category !== item.category) continue;
    const have = factsOf(entry);
    if (have.title !== wanted.title) continue;
    if (wanted.volume !== null && have.volume !== null && wanted.volume !== have.volume) continue;

    const verdicts = [compareCreators(wanted.creator, have.creator), compareYears(wanted.year, have.year)];
    if (verdicts.includes("conflict")) continue;
    candidates.push({ entry, support: verdicts.filter((v) => v === "match").length });
  }

  if (bare) return candidates.length === 1 ? candidates[0].entry : null;
  // An entry that says nothing about creator or year cannot vouch for a candidate that does.
  const supported = candidates.filter((c) => c.support > 0).sort((a, b) => b.support - a.support || a.entry.id - b.entry.id);
  return supported[0]?.entry ?? null;
}
