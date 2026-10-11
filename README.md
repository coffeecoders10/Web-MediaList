# The Archive

A multi-user library of the books, movies, TV series and anime you've finished, are in the middle of, or plan to get to. Accounts, sessions and storage run on the CoffeeCoders Backbone API (`docs/backend-arch-docs`).

## Setup

```bash
cp .env.example .env.local   # then fill in the three values
npm run dev                  # http://localhost:3000
npm run lint && npx tsc --noEmit && npm run build
```

| Variable | What it is |
| --- | --- |
| `BACKBONE_URL` | Base URL of the Backbone server. |
| `BACKBONE_DB_QUERY_API_KEY` | Backbone's `db_query_api_key`. Server-side only; it grants access to every row. |
| `BACKBONE_STATIC_TABLE` / `BACKBONE_DYNAMIC_TABLE` | Table names for the catalog (`db_query`) and user collections (`db_query_dynamic`). Optional; default `media_list` and `user_media`. |
| `SESSION_SECRET` | 32+ random characters used to sign session cookies (`openssl rand -base64 32`). |

Serve production over HTTPS: the session cookie is `Secure` when `NODE_ENV=production`.

## Architecture

```
Browser ──Server Actions──▶ Next.js server ──▶ Backbone
            (session cookie)   (holds the API key)   /auth, /db_query/media_list, /db_query_dynamic/user_media
```

**Accounts and sessions.** Backbone's `/auth` only verifies credentials, so the Next server owns the session: after login or signup it sets a signed (HS256, `jose`) `httpOnly`, `SameSite=lax` cookie that lasts 30 days, which keeps users signed in across refreshes and browser restarts. `proxy.ts` does an optimistic redirect; every page, layout and Server Action re-verifies the session close to the data (`lib/server/session.ts`) and takes the user id from it, never from client input. Failed logins are throttled in `lib/server/throttle.ts`.

**Shared catalog** (`lib/server/catalog.ts`, `sop-db-query.md`). One `media_list` row per category (book, movie, series, anime) holds `{ nextId, entries }`, so each category numbers its entries 1, 2, 3… Entries carry only metadata about the work: title, creator, year, genres, tags, synopsis, cover, and totals such as pages, chapters, series info, runtime or episodes per season. Backbone cannot list rows, so a manifest of row ids is kept in `user_media` under the reserved id `__catalog_manifest__`. The first request creates the catalog rows; creating that id is atomic, so concurrent first requests cannot both do it.

**Personal collections** (`lib/server/collection.ts`, `sop-db-query-dynamic.md`). `user_media/<user_id>` holds `{ entries: { "book-12": {...} } }`: a reference into the catalog plus only what is personal (status, progress, rating, notes, added/started/finished dates). If a user edits a shared field (say a title or a page count), the difference is stored as that user's `overrides`; the catalog entry itself is never changed by editing. Deleting removes the reference only.

**Adding a title.** The server files it in the catalog under a lock, then references it from the user's collection:

1. `lib/media/match.ts` looks for the same work in that category: equal normalized titles (case, accents, punctuation and leading articles ignored), no disagreement on creator, year or book volume, and a creator or year match to back the title up. A bare title (no creator, no year) joins an existing entry only if exactly one entry has that title. When in doubt it creates a new entry: a near-duplicate is cheaper than merging two different works or editions.
2. If found, its id is reused. Otherwise a new entry takes `nextId`.
3. `lib/server/lock.ts` serializes this per category across server instances. Backbone has no locking, but creating a `user_media` row with an existing id fails, so that is used as a mutex (with an expiry so a crashed holder cannot block others).

**UI.** Components still work with one merged `MediaItem` (catalog + overrides + personal fields, built by `lib/media/model.ts`), so search, filters, sorting, genres, stats and progress rules are unchanged. `lib/media/store.tsx` holds the collection client-side, applies edits optimistically, sends them to the server one at a time in order, and rolls back with a message if one fails.

**Migration.** Collections saved in this browser's `localStorage` (the old `the-archive:collection:v1`) are offered for import after sign-in, and stay available from the account menu until imported. The menu also imports/exports JSON and adds the sample titles (`lib/media/seed.json`). Imports are additive and skip titles already in the collection.

## Layout

- `app/(auth)/` login and signup. `app/(app)/` the signed-in app: Library (`/`), Genres, Stats, `media/[id]`. `app/actions/` Server Actions.
- `components/` UI, each with its own CSS Module. Radix UI primitives provide dialogs, selects, toggles, menus, sliders and toasts.
- `lib/media/` types, filtering, progress rules, stats, matching and the catalog/user split: pure functions, no React.
- `lib/server/` server-only code: Backbone client, locking, catalog, collections, sessions.

## Known limitations

- **Sessions are stateless.** There is no server-side revocation or "sign out everywhere"; a stolen cookie works until it expires. Backbone has no password reset, change or delete endpoints either.
- **Login throttling is per server instance** (in memory). Add an edge or WAF rate limit for a shared limit.
- **Writes by one user from two places at once** (two tabs, or requests on different server instances at the same moment) can overwrite each other, because Backbone replaces whole documents. A single tab sends its changes in order, which covers normal use.
- **Each catalog is one document**, read in full whenever a user loads a library that references it. Fine for thousands of entries; shard it if the shared catalog grows far beyond that.
- **Orphans are possible but harmless:** a failure between filing a title in the catalog and saving it to the user's collection leaves an unreferenced catalog entry, which the next matching add reuses.
- If a first-ever setup is killed mid-way, the manifest row clears itself after about 8 seconds and setup retries; unused catalog rows may be left behind.
- Shared fields are only ever written when a title first enters the catalog. There is no UI for correcting a shared entry for everyone.
