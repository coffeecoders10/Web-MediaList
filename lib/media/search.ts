import { fold, normalizeTitle } from "./match";
import type { CatalogEntry } from "./model";

/** Shortest query worth searching for; one letter matches half the catalog. */
export const MIN_QUERY = 2;

/** How well a title fits what was typed: lower is better, null is no match. */
function rank(title: string, query: string, terms: string[]): number | null {
  const full = fold(title);
  const bare = normalizeTitle(title);
  if (full.startsWith(query) || bare.startsWith(normalizeTitle(query))) return 0;
  if (` ${full}`.includes(` ${query}`)) return 1;
  if (full.includes(query)) return 2;
  return terms.every((t) => full.includes(t)) ? 3 : null;
}

/** Catalog entries whose title matches the query, best first: prefix, then word start, then anywhere. */
export function searchEntries(entries: CatalogEntry[], query: string, limit = 8): CatalogEntry[] {
  const q = fold(query);
  if (q.length < MIN_QUERY) return [];
  const terms = q.split(" ").filter(Boolean);

  const ranked: { entry: CatalogEntry; score: number }[] = [];
  for (const entry of entries) {
    const score = rank(typeof entry.title === "string" ? entry.title : "", q, terms);
    if (score !== null) ranked.push({ entry, score });
  }
  return ranked
    .sort((a, b) => a.score - b.score || String(a.entry.title).localeCompare(String(b.entry.title)))
    .slice(0, limit)
    .map((r) => r.entry);
}
