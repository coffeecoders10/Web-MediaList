# Media fields by category

Each title is split in two:

- **Catalog entry** (shared): facts about the work itself, stored once per title in the `media_list` table and reused by every user.
- **Collection entry** (personal): one user's status, progress, rating, notes and dates, stored in `user_media/<user_id>`.

Only `title` is required. Every other key, including `year`, is optional; a blank value is stored empty or null.

## Shared catalog keys

Every catalog entry also carries `id`, `category` and `createdAt`, which the server sets.

### Book
```
title
creator          author
year
genres           list
synopsis
posterUrl
art              { hue, pattern }, generated cover used when there is no poster
chaptersTotal
series           { name, volume }
```

### Movie
```
title
creator          director
year
type             free text, e.g. Hollywood, Bollywood
genres
synopsis
posterUrl
art
runtimeMinutes
series           { name, volume }, the franchise and the part within it (volume is the part number)
```

### TV series
```
title
creator
year
genres
synopsis
posterUrl
art
totalSeasons
```

### Anime
```
title
creator          studio
year
genres
synopsis
posterUrl
art
totalSeasons
totalEpisodes
```

## Personal keys (not in the catalog)

| Category | Keys |
| --- | --- |
| All | `status`, `rating`, `notes`, `addedAt`, `startedAt`, `finishedAt`, `updatedAt` |
| Book | `chaptersRead` |
| Movie | none beyond the common keys |
| TV series | `currentSeason` |
| Anime | `tracking` (`"seasons"` or `"episodes"`), `currentSeason`, `currentEpisode` |

A collection entry holds only the reference (`category`, `catalogId`) and these personal keys, never a copy of the shared ones.

Editing a shared key updates the catalog entry itself, so every user who has the title sees the change. Only intentional changes are written: a field must differ from what the form was opened with, and an empty value never overwrites an existing one. A title typed by hand that matches an existing entry only fills in keys the entry has no value for.

## Progress display

| Category | Counted in | Example label |
| --- | --- | --- |
| Book | chapters | `3 / 10 Chapters` |
| Movie | no progress | none |
| TV series | seasons | `1 / 2 Seasons` |
| Anime (seasons mode) | seasons | `3 / 5 Seasons` |
| Anime (episodes mode) | episodes | `24 / 100 Episodes` |

If the total is unknown, only the position is shown (for example `Chapter 3`), with no bar. A current position cannot exceed a known total.

## Samples

Minimal entries:

```json
{ "category": "book", "title": "Piranesi" }
{ "category": "movie", "title": "Arrival" }
{ "category": "series", "title": "Severance" }
{ "category": "anime", "title": "One Piece" }
```

Full catalog entries (shared keys only):

```json
{ "category": "book", "title": "Dune Messiah", "creator": "Frank Herbert", "year": 1969,
  "genres": ["Science fiction"], "synopsis": "Twelve years after Arrakis fell to the Fremen.",
  "posterUrl": "", "chaptersTotal": 10, "series": { "name": "Dune", "volume": 2 } }

{ "category": "movie", "title": "Arrival", "creator": "Denis Villeneuve", "year": 2016, "type": "Hollywood",
  "genres": ["Science fiction"], "runtimeMinutes": 116, "series": null }

{ "category": "movie", "title": "Harry Potter and the Chamber of Secrets", "creator": "Chris Columbus", "year": 2002,
  "type": "Hollywood", "genres": ["Fantasy"], "runtimeMinutes": 161, "series": { "name": "Harry Potter", "volume": 2 } }

{ "category": "series", "title": "Severance", "creator": "Dan Erickson", "year": 2022,
  "genres": ["Thriller"], "totalSeasons": 2 }

{ "category": "anime", "title": "Attack on Titan", "creator": "Wit Studio", "year": 2013,
  "genres": ["Action"], "totalSeasons": 5, "totalEpisodes": 87 }
```

The key lists live in `lib/media/model.ts` (`SHARED_KEYS` and `OWN_KEYS`).
