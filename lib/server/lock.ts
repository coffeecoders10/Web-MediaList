import "server-only";
import { randomUUID } from "node:crypto";
import { BackboneError, userMedia } from "./backbone";

/**
 * Cross-instance mutex built on the one atomic primitive Backbone offers: creating a
 * `user_media` row with an id that already exists fails. Whoever creates `__lock__:<name>`
 * holds the lock; deleting the row releases it. Backbone has no locking of its own, and
 * catalog writes are read-modify-write on a whole document, so without this two users adding
 * titles at the same moment would overwrite each other.
 *
 * A lock carries an expiry so a crashed holder cannot block everyone forever.
 */

const TTL_MS = 15_000;
const WAIT_MS = 20_000;
const UNREADABLE_MS = 4_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const idOf = (name: string) => `__lock__:${name}`;

interface LockDoc extends Record<string, unknown> {
  owner: string;
  expiresAt: number;
}

async function acquire(name: string): Promise<string> {
  const id = idOf(name);
  const owner = randomUUID();
  const deadline = Date.now() + WAIT_MS;
  let unreadableSince: number | null = null;

  while (Date.now() < deadline) {
    if (await userMedia.create(id)) {
      const doc: LockDoc = { owner, expiresAt: Date.now() + TTL_MS };
      await userMedia.write(id, doc);
      return owner;
    }

    const held = await userMedia.read<LockDoc>(id);
    if (held === null) {
      // Created but not yet written (its holder is between the two calls), or already released.
      unreadableSince ??= Date.now();
      if (Date.now() - unreadableSince > UNREADABLE_MS) await userMedia.remove(id);
    } else {
      unreadableSince = null;
      if (typeof held.expiresAt !== "number" || held.expiresAt < Date.now()) await userMedia.remove(id);
    }
    await sleep(60 + Math.random() * 120);
  }
  throw new BackboneError(`Timed out waiting for lock "${name}"`, 503);
}

/** Runs `task` while holding the named lock. Keep it short: it must finish well within the TTL. */
export async function withLock<T>(name: string, task: () => Promise<T>): Promise<T> {
  const owner = await acquire(name);
  try {
    return await task();
  } finally {
    // Only release our own lock: if ours expired mid-task, someone else may hold it now.
    try {
      const held = await userMedia.read<LockDoc>(idOf(name));
      if (held?.owner === owner) await userMedia.remove(idOf(name));
    } catch {
      // The TTL will clear it.
    }
  }
}
