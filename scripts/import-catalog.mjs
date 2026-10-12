#!/usr/bin/env node
/**
 * Merges a JSON file of titles into the shared media catalog (one `media_list` row per category) in Backbone.
 *
 *   node scripts/import-catalog.mjs book docs/books.json          # dry run: prints what would be added / overwritten
 *   node scripts/import-catalog.mjs book docs/books.json --yes   # writes the merged catalog
 *   node scripts/import-catalog.mjs book docs/books.json --remove="Old Title" --yes   # also deletes that title
 *
 * Works for every category (book, movie, series, anime). The file is an array of entries using the shared keys
 * from docs/media-catalog-fields.md. `author` (books), `director` (movies) and `studio` (anime) are accepted as
 * aliases for `creator`. For anime the catalog's creator is the studio, so `studio`, when present, wins over a
 * `creator` that names the original author.
 *
 * Titles are matched on title only, ignoring case, accents, punctuation and a leading "the/a/an" (the same rule
 * the app uses). A title already in the catalog is overwritten by the incoming entry, keeping its `id` and
 * `createdAt` so references in user collections stay valid; any other title is appended with the next free id.
 * If the file repeats a title, the last occurrence wins. `--remove="Title"` (repeatable) deletes a title from the
 * catalog, e.g. an entry replaced by several finer-grained ones; other ids are left alone and removed ids are never reused.
 *
 * Credentials come from .env.local (BACKBONE_URL, BACKBONE_DB_QUERY_API_KEY and the optional table names).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CATEGORIES = ["book", "movie", "series", "anime"];
const MANIFEST_ID = "__catalog_manifest__";

// Keep in sync with SHARED_KEYS in lib/media/model.ts.
const COMMON = ["title", "creator", "year", "genres", "synopsis", "posterUrl", "art"];
const SHARED_KEYS = {
  book: [...COMMON, "chaptersTotal", "series"],
  movie: [...COMMON, "type", "runtimeMinutes", "series"],
  series: [...COMMON, "totalSeasons"],
  anime: [...COMMON, "totalSeasons", "totalEpisodes"],
};
const CREATOR_ALIASES = ["author", "director", "studio"];

// Same rule as normalizeTitle in lib/media/match.ts.
const normalizeTitle = (title) =>
  title
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/^(the|a|an) (?=.)/, "");

const args = process.argv.slice(2);
const confirmed = args.includes("--yes");
const removals = args.filter((a) => a.startsWith("--remove=")).map((a) => a.slice("--remove=".length));
const [category, file, ...extra] = args.filter((a) => !a.startsWith("--"));
if (!CATEGORIES.includes(category) || !file || extra.length) {
  console.error(`Usage: node scripts/import-catalog.mjs <${CATEGORIES.join("|")}> <file.json> [--yes]`);
  process.exit(1);
}

let incoming;
try {
  incoming = JSON.parse(readFileSync(resolve(file), "utf8"));
} catch (e) {
  console.error(`Could not read ${file}: ${e.message}`);
  process.exit(1);
}
if (!Array.isArray(incoming)) {
  console.error(`${file} must contain a JSON array of entries.`);
  process.exit(1);
}

/** Reduces a raw entry to the shared keys of the category; returns null when it has no usable title. */
function clean(raw) {
  if (!raw || typeof raw !== "object" || typeof raw.title !== "string" || !raw.title.trim()) return null;
  const source = { ...raw };
  if (category === "anime" && source.studio !== undefined) {
    source.creator = source.studio;
  } else if (source.creator === undefined) {
    const alias = CREATOR_ALIASES.find((k) => source[k] !== undefined);
    if (alias) source.creator = source[alias];
  }
  const entry = {};
  for (const key of SHARED_KEYS[category]) if (source[key] !== undefined) entry[key] = source[key];
  entry.title = entry.title.trim();
  return entry;
}

const wanted = new Map(); // normalized title -> cleaned entry (last occurrence wins)
let skipped = 0;
let repeated = 0;
for (const raw of incoming) {
  const entry = clean(raw);
  const key = entry && normalizeTitle(entry.title);
  if (!key) {
    skipped++;
    continue;
  }
  if (wanted.has(key)) repeated++;
  wanted.set(key, entry);
}

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

try {
  const manifest = await request(`/db_query_dynamic/${dynamicTable}/${MANIFEST_ID}`);
  const row = manifest.mjson?.rows?.[category];
  if (typeof row !== "number") throw new Error(`no catalog row for "${category}" in the manifest (open the app once to create it)`);

  const path = `/db_query/${staticTable}/${row}`;
  const doc = (await request(path)).pjson ?? {};
  const entries = doc.entries && typeof doc.entries === "object" ? doc.entries : {};
  const highest = Math.max(0, ...Object.values(entries).map((e) => Number(e?.id) || 0));
  let nextId = Math.max(Number(doc.nextId) || 1, highest + 1);

  // Lowest id first, so a title that already appears twice is overwritten at its original entry.
  const existing = new Map();
  for (const entry of Object.values(entries).sort((a, b) => a.id - b.id)) {
    const k = normalizeTitle(String(entry.title ?? ""));
    if (k && !existing.has(k)) existing.set(k, entry);
  }

  const now = new Date().toISOString();
  const merged = { ...entries };
  let added = 0;
  let overwritten = 0;
  for (const [k, entry] of wanted) {
    const current = existing.get(k);
    if (current) {
      merged[String(current.id)] = { id: current.id, category, createdAt: current.createdAt ?? now, ...entry };
      overwritten++;
      console.log(`  overwrite  #${current.id}  ${entry.title}`);
    } else {
      const id = nextId++;
      merged[String(id)] = { id, category, createdAt: now, ...entry };
      added++;
      console.log(`  add        #${id}  ${entry.title}`);
    }
  }

  let removed = 0;
  for (const title of removals) {
    const k = normalizeTitle(title);
    const current = existing.get(k);
    if (!current || wanted.has(k)) {
      console.log(`  keep       ${title} (${current ? "also in the file" : "not in the catalog"})`);
      continue;
    }
    delete merged[String(current.id)];
    removed++;
    console.log(`  remove     #${current.id}  ${current.title}`);
  }

  const note = [skipped && `${skipped} without a title skipped`, repeated && `${repeated} repeated in the file`].filter(Boolean);
  const summary = `${category} row ${row}: ${added} added, ${overwritten} overwritten, ${removed} removed, ${Object.keys(entries).length} existing${note.length ? ` (${note.join(", ")})` : ""}`;

  if (!confirmed) {
    console.log(`\n${summary} (dry run)\nRe-run with --yes to write.`);
  } else {
    await request(path, "PUT", { pjson: { v: 1, category, nextId, entries: merged } });
    const after = (await request(path)).pjson ?? {};
    const count = Object.keys(after.entries ?? {}).length;
    const expected = Object.keys(merged).length;
    if (count !== expected) throw new Error(`expected ${expected} entries after writing, found ${count}`);
    console.log(`\n${summary}; verified ${count} entries`);
  }
} catch (e) {
  console.error(`${category}: ${e.message}`);
  process.exit(1);
}
