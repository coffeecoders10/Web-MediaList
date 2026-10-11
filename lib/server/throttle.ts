import "server-only";

/**
 * Failed-login throttle. Backbone has no rate limiting, so this is the only brake on password
 * guessing. State is per server instance (in memory): it slows a single attacker down but is not
 * a shared limit across serverless instances. Put a WAF or edge rate limit in front for that.
 */

const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

function live(key: string) {
  const entry = attempts.get(key);
  if (entry && entry.resetAt <= Date.now()) {
    attempts.delete(key);
    return undefined;
  }
  return entry;
}

export function isThrottled(key: string, limit: number): boolean {
  return (live(key)?.count ?? 0) >= limit;
}

export function recordAttempt(key: string): void {
  const entry = live(key);
  if (entry) entry.count++;
  else attempts.set(key, { count: 1, resetAt: Date.now() + WINDOW_MS });
  // Keep the map from growing without bound under a spray of usernames.
  if (attempts.size > 5000) for (const [k, v] of attempts) if (v.resetAt <= Date.now()) attempts.delete(k);
}

export function clearFailures(key: string): void {
  attempts.delete(key);
}
