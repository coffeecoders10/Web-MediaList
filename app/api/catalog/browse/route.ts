import type { CatalogBrowseResult } from "@/lib/media/api";
import { browseCatalog } from "@/lib/server/catalog";
import { getSession } from "@/lib/server/session";

/** Every shared catalog title in slim form, for the bulk-add picker. Filtering happens in the browser. */
export async function GET() {
  if (!(await getSession())) return Response.json({ error: "Sign in to browse the catalog." }, { status: 401 });

  try {
    return Response.json({ entries: await browseCatalog() } satisfies CatalogBrowseResult, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[catalog-browse]", error);
    return Response.json({ error: "Couldn't load the catalog." }, { status: 502 });
  }
}
