import { ART_PATTERNS, type CoverArt, type MediaItem } from "./types";

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Entries without authored art get a stable cover derived from their title. */
export function coverArt(item: Pick<MediaItem, "title" | "art">): CoverArt {
  if (item.art) return item.art;
  const h = hash(item.title.toLowerCase());
  return { hue: h % 360, pattern: ART_PATTERNS[(h >>> 9) % ART_PATTERNS.length] };
}

export function newId(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${slug || "entry"}-${Math.random().toString(36).slice(2, 7)}`;
}
