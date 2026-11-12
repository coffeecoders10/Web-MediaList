# Backbone Client SOPs

**Docs version: 1.1.0**

Agent-ready Standard Operating Procedures for **using** the Backbone API from another
project. Each SOP is self-contained: give an agent one file and it has the endpoints,
auth, request/response shapes, error handling, and a step-by-step procedure for that
feature. They do not cover how to re-implement the backend.

| SOP | Feature | Route prefix | Auth |
| --- | --- | --- | --- |
| [sop-db-query.md](sop-db-query.md) | JSON documents in named tables, server-assigned integer ids | `/db_query` | `Authorization: Bearer <db_query_api_key>` |
| [sop-db-query-dynamic.md](sop-db-query-dynamic.md) | Free-form JSON documents keyed by a string id you choose | `/db_query_dynamic` | same `db_query_api_key` |
| [sop-user-auth.md](sop-user-auth.md) | Username/password signup and login | `/auth` | none (public) |
| [sop-password-reset.md](sop-password-reset.md) | Two-step password reset (request code, then set new password) | `/auth/reset-password`, `/auth/update-password` | none (public; see its security model) |
| [sop-socket.md](sop-socket.md) | Real-time Socket.IO rooms (join, leave, broadcast) | Socket.IO namespace `/socket`, path `/flask_api/socket.io` | none |

## Typical combination

1. `POST /auth/signup` or `/auth/login` → get `user.user_id`.
2. Use `user_id` as the `id` in `/db_query_dynamic/user_media` to store that user's data.

## What the agent needs from you

- The Backbone base URL.
- The `db_query_api_key` (for the two db SOPs), supplied via environment variable.
- For sockets, only the URL and path in [sop-socket.md](sop-socket.md); no key needed.
- For a new table, ask the Backbone owner to add it; clients cannot create tables.

## Shared rules

- Send `Content-Type: application/json` on every request with a body.
- API keys are server secrets: keep them in backend environment config, never in
  browser/mobile code or source control.
- Errors are JSON: `{"error": "<message>"}`.

## Versioning (maintainers: read before editing any doc)

This folder is versioned as a whole using [semantic versioning](https://semver.org). The
single source of truth is the **Docs version** line at the top of this file.

**Whenever you add, change, or remove anything in `docs/`, you must bump the version in
the same change:**

| Change | Bump | Example |
| --- | --- | --- |
| Typo, wording, formatting, clarification with no change in meaning | PATCH | 1.1.0 → 1.1.1 |
| New SOP, new section, new endpoint documented, new example (backwards-compatible) | MINOR | 1.1.0 → 1.2.0 |
| Documented behavior changed or removed (renamed endpoint, changed auth, changed response shape, deleted SOP) | MAJOR | 1.1.0 → 2.0.0 |

Steps:

1. Edit the docs.
2. Update the `Docs version` line above (reset lower numbers to 0 on a MINOR or MAJOR bump).
3. Add an entry to the changelog below, newest first.
4. If the change documents a code change, make sure the SOP matches the code in `routers/`.

### Changelog

- **1.1.0**: Added [sop-password-reset.md](sop-password-reset.md); updated
  [sop-user-auth.md](sop-user-auth.md) to link to it; added versioning rules.
- **1.0.0**: Initial SOP set (db_query, db_query_dynamic, user auth, socket).
