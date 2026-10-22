import "server-only";
import { userMedia } from "./backbone";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Reads a `user_media` document, creating it with `empty` first when the row doesn't exist yet. Backbone
 * rows start without a document, so creating one is always a create followed by a write.
 */
export async function readOrCreate<T extends Record<string, unknown>>(id: string, empty: T): Promise<Partial<T>> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const doc = await userMedia.read<Partial<T>>(id);
    if (doc) return doc;
    if (await userMedia.create(id)) {
      await userMedia.write(id, empty);
      return empty;
    }
    await sleep(100); // another request is creating it right now
  }
  await userMedia.write(id, empty);
  return empty;
}

/**
 * Backbone documents are replaced whole, so concurrent read-modify-writes of one document would drop
 * each other's changes. This queues them per key within a server instance.
 */
const queues = new Map<string, Promise<unknown>>();
export function serial<T>(key: string, task: () => Promise<T>): Promise<T> {
  const run = (queues.get(key) ?? Promise.resolve()).catch(() => {}).then(task);
  queues.set(key, run);
  void run.finally(() => queues.get(key) === run && queues.delete(key)).catch(() => {});
  return run;
}
