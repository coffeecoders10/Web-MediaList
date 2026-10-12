#!/usr/bin/env node
/**
 * Empties the shared media catalog (one `media_list` row per category) in Backbone.
 *
 *   node scripts/clear-catalog.mjs          # dry run: prints what each category holds
 *   node scripts/clear-catalog.mjs --yes    # clears every category
 *   node scripts/clear-catalog.mjs --yes book movie   # clears only the listed categories
 *
 * Credentials come from .env.local (BACKBONE_URL, BACKBONE_DB_QUERY_API_KEY and the optional table names).
 * Each row keeps its `nextId`, so ids are never reused and stale references in user collections can't
 * end up pointing at a different title. User collections themselves are not touched: Backbone cannot
 * list rows, and those references are ignored when they no longer match a catalog entry.
 */
import { resolve } from "node:path";

const CATEGORIES = ["book", "movie", "series", "anime"];
const MANIFEST_ID = "__catalog_manifest__";

try {
  process.loadEnvFile(resolve(import.meta.dirname, "..", ".env.local"));
} catch {
  console.error("Could not read .env.local at the project root.");
  process.exit(1);
}

const base = process.env.BACKBONE_URL?.replace(/\/+$/, "");
const key = process.env.BACKBONE_DB_QUERY_API_KEY;
const staticTable = process.env.BACKBONE_STATIC_TABLE || "media_list";
const dynamicTable = process.env.BACKBONE_DYNAMIC_TABLE || "user_media";
if (!base || !key) {
  console.error("BACKBONE_URL and BACKBONE_DB_QUERY_API_KEY must be set in .env.local.");
  process.exit(1);
}

const args = process.argv.slice(2);
const confirmed = args.includes("--yes");
const requested = args.filter((a) => !a.startsWith("--"));
const unknown = requested.filter((c) => !CATEGORIES.includes(c));
if (unknown.length) {
  console.error(`Unknown categories: ${unknown.join(", ")}. Choose from: ${CATEGORIES.join(", ")}.`);
  process.exit(1);
}
const targets = requested.length ? requested : CATEGORIES;

async function request(path, method = "GET", body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${data.error ?? "unexpected response"}`);
  return data;
}

const manifest = await request(`/db_query_dynamic/${dynamicTable}/${MANIFEST_ID}`).catch((e) => {
  console.error(`Could not read the catalog manifest: ${e.message}`);
  process.exit(1);
});
const rows = manifest.mjson?.rows ?? {};

let failed = false;
for (const category of targets) {
  const row = rows[category];
  if (typeof row !== "number") {
    console.log(`${category.padEnd(7)} no catalog row in the manifest, nothing to clear`);
    continue;
  }
  const path = `/db_query/${staticTable}/${row}`;
  try {
    const doc = (await request(path)).pjson ?? {};
    const count = Object.keys(doc.entries ?? {}).length;
    const highest = Math.max(0, ...Object.values(doc.entries ?? {}).map((e) => Number(e?.id) || 0));
    const nextId = Math.max(Number(doc.nextId) || 1, highest + 1);
    const clean = count === 0 && doc.v === 1 && doc.category === category && doc.nextId === nextId;

    if (clean) {
      console.log(`${category.padEnd(7)} row ${row}: already clean`);
    } else if (!confirmed) {
      console.log(`${category.padEnd(7)} row ${row}: ${count} entries would be removed (dry run)`);
    } else {
      await request(path, "PUT", { pjson: { v: 1, category, nextId, entries: {} } });
      const after = (await request(path)).pjson ?? {};
      const left = Object.keys(after.entries ?? {}).length;
      if (left !== 0) throw new Error(`${left} entries remain after clearing`);
      console.log(`${category.padEnd(7)} row ${row}: removed ${count} entries, verified empty`);
    }
  } catch (e) {
    failed = true;
    console.error(`${category.padEnd(7)} row ${row}: ${e.message}`);
  }
}

if (!confirmed) console.log("\nDry run only. Re-run with --yes to clear.");
process.exit(failed ? 1 : 0);
