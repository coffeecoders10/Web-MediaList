# Lightbox

A personal library of the books, movies, TV series and anime you've finished, are in the middle of, or plan to get to.

```bash
npm run dev     # http://localhost:3000
npm run lint && npx tsc --noEmit && npm run build
```

## How data works

- `lib/media/seed.json` holds the sample collection and is never written to.
- Edits persist in `localStorage` (`lightbox:collection:v1`). "Restore sample collection" in the `…` menu resets it; export and import use JSON.
- The UI only talks to the `MediaRepository` interface in `lib/media/repository.ts`. To add a database, implement that interface (list, save, remove, replaceAll) and change the instance exported at the bottom of the file.
- `lib/media/normalize.ts` validates anything coming from the seed, storage or an import.

## Layout

- `app/` routes: Library (`/`), Genres, Stats, and `media/[id]`.
- `components/` UI, each with its own CSS Module. Radix UI primitives provide dialogs, selects, tabs, toggles, popovers, menus and toasts.
- `lib/media/` types, filtering, progress rules and stats. These are pure functions with no React in them.
