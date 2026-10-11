# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 16 App Router, React 19, TypeScript, Radix UI primitives, CSS Modules / plain CSS. No Tailwind. (Stated in the brief.)

## Users

One person: the owner of the collection. They log books, movies, TV series and anime they have finished, are in the middle of, or plan to consume, and they also show the collection off. (Inferred from the brief; not interviewed.)

## Product Purpose

A personal media tracker and showcase. It holds a collection of Books, Movies, TV Series and Anime with posters, ratings, genres, status and progress (pages/chapters/series for books, seasons/episodes for shows, episodes for anime). It has a browse view, an edit mode for add/edit/delete/progress updates, search/sort/filter, a genre explorer, a stats dashboard and a detail view per entry.

## Capabilities and Constraints

- Statuses: Completed, In Progress, Planned, On Hold, Dropped.
- Data: a local JSON seed file with sample entries. Edits persist in localStorage and never modify the seed. The data layer must be swappable for a database later without refactoring the UI.
- No backend, auth or database yet.
- Dark theme only is required by the brief.

## Evidence on Hand

No real collection data or poster assets exist. Sample entries and artwork are illustrative and must be labelled as sample data; the owner replaces them.

## Product Principles

- The collection is the hero; chrome recedes.
- Looking and editing are the same place: edit mode changes what you can do, not where you are.
- Progress is always legible at a glance.
- Data access sits behind one interface so storage can change.

## Accessibility & Inclusion

Keyboard operable, visible focus, WCAG AA contrast, reduced-motion respected, responsive to phone width.
