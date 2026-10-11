import "server-only";

/**
 * Thin client for the Backbone API (docs/backend-arch-docs). Server-only: the db_query API key
 * grants access to every row, so it must never reach the browser.
 */

export class BackboneError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "BackboneError";
  }
}

function config() {
  const url = process.env.BACKBONE_URL?.replace(/\/+$/, "");
  const key = process.env.BACKBONE_DB_QUERY_API_KEY;
  if (!url || !key) throw new Error("BACKBONE_URL and BACKBONE_DB_QUERY_API_KEY must be set (see .env.example).");
  return { url, key };
}

interface Reply<T> {
  url: string;
  status: number;
  ok: boolean;
  data: T;
}

async function call<T>(path: string, method: string, body: unknown, withKey: boolean): Promise<Reply<T>> {
  const { url, key } = config();
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (withKey) headers.Authorization = `Bearer ${key}`;
  const res = await fetch(`${url}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { url: `${url}${path}`, status: res.status, ok: res.ok, data };
}

const messageOf = (data: unknown) =>
  data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : "Unexpected response";

/** Throws unless the status is one of the `allowed` non-2xx statuses the caller handles itself. */
function check<T>(reply: Reply<T>, what: string, allowed: number[] = []): Reply<T> {
  if (!reply.ok && !allowed.includes(reply.status)) {
    throw new BackboneError(`${what} failed (${reply.status}): ${messageOf(reply.data)}`, reply.status);
  }
  return reply;
}

/** `/auth/*` is public: no API key is sent. */
export async function authRequest(action: "signup" | "login", body: Record<string, string>) {
  return call<{ user?: BackboneUser; error?: string }>(`/auth/${action}`, "POST", body, false);
}

export interface BackboneUser {
  user_id: string;
  username: string;
  full_name: string;
}

const enc = encodeURIComponent;

/** Table names are configurable in case Backbone renames them; the defaults are the documented ones. */
const staticTable = () => process.env.BACKBONE_STATIC_TABLE || "media_list";
const dynamicTable = () => process.env.BACKBONE_DYNAMIC_TABLE || "user_media";

/** The static `db_query` table (default `media_list`): JSON documents with server-assigned integer ids. */
export const mediaList = {
  async create(name: string, description: string): Promise<number> {
    const r = check(await call<{ project_id: number }>(`/db_query/${staticTable()}`, "POST", { name, description }, true), "Create row");
    return r.data.project_id;
  },
  async read<T>(id: number): Promise<T> {
    return check(await call<{ pjson: T }>(`/db_query/${staticTable()}/${id}`, "GET", undefined, true), "Read row").data.pjson;
  },
  async write(id: number, doc: unknown): Promise<void> {
    check(await call(`/db_query/${staticTable()}/${id}`, "PUT", { pjson: doc }, true), "Write row");
  },
};

/** The dynamic `db_query_dynamic` table (default `user_media`): JSON objects under ids the client chooses. */
export const userMedia = {
  /** False when the id is already taken. Creation is atomic, which the lock and bootstrap rely on. */
  async create(id: string): Promise<boolean> {
    const r = await call(`/db_query_dynamic/${dynamicTable()}`, "POST", { id }, true);
    if (r.ok) return true;
    // A duplicate id surfaces as a 500 whose message is the database's uniqueness error.
    if (r.status === 500 && /unique|constraint|duplicate|already/i.test(messageOf(r.data))) return false;
    throw new BackboneError(`Create ${id} failed (${r.status}): ${messageOf(r.data)}`, r.status);
  },
  /** Null when the row is missing, or exists but has not been written yet. */
  async read<T>(id: string): Promise<T | null> {
    const r = check(await call<{ mjson: T }>(`/db_query_dynamic/${dynamicTable()}/${enc(id)}`, "GET", undefined, true), "Read document", [404, 500]);
    return r.ok ? r.data.mjson : null;
  },
  async write(id: string, doc: Record<string, unknown>): Promise<void> {
    check(await call(`/db_query_dynamic/${dynamicTable()}/${enc(id)}`, "PUT", doc, true), "Write document");
  },
  async remove(id: string): Promise<void> {
    check(await call(`/db_query_dynamic/${dynamicTable()}/${enc(id)}`, "DELETE", undefined, true), "Delete document", [404]);
  },
};
