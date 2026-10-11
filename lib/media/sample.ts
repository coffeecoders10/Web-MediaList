import { normalizeList } from "./normalize";
import type { MediaItem } from "./types";

/** The bundled sample titles. Loaded on demand so they don't weigh on every page. */
export async function loadSample(): Promise<MediaItem[]> {
  const { default: seed } = await import("./seed.json");
  return normalizeList(seed);
}
