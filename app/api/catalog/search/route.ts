import type { NextRequest } from "next/server";
import type { CatalogSearchResult } from "@/lib/media/api";
import { MIN_QUERY } from "@/lib/media/search";
import { isCategory } from "@/lib/media/types";
import { searchCatalog } from "@/lib/server/catalog";
import { getSession } from "@/lib/server/session";

/**
 * Title suggestions from the shared catalog, restricted to one category. A Route Handler rather than a
 * Server Action: Server Actions run one at a time per client, which would queue keystrokes behind each
 * other, whereas fetches can run in parallel and be aborted as the user keeps typing.
 */
const MAX_QUERY = 120;

export async function GET(request: NextRequest) {
  if (!(await getSession())) return Response.json({ error: "Sign in to search." }, { status: 401 });

  const category = request.nextUrl.searchParams.get("category");
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY);
  if (!isCategory(category)) return Response.json({ error: "Unknown category." }, { status: 400 });
  if (query.length < MIN_QUERY) return Response.json({ results: [] } satisfies CatalogSearchResult);

  try {
    return Response.json({ results: await searchCatalog(category, query) } satisfies CatalogSearchResult, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[catalog-search]", error);
    return Response.json({ error: "Couldn't search the catalog." }, { status: 502 });
  }
}
