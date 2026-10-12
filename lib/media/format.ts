import type { MediaItem } from "./types";

/** The line under a title: creator, year and (for films) the kind of film, skipping whatever isn't set. */
export function bylineOf(item: MediaItem): string {
  return [item.creator, item.year, item.category === "movie" ? item.type : null].filter(Boolean).join(" · ");
}

export function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}

/** "11 Oct 2026". Dates are calendar days, so they are formatted in UTC to avoid off-by-one shifts. */
export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export const formatNumber = (n: number) => n.toLocaleString("en");
