import { TRPCError } from "@trpc/server";

/**
 * Per-process sliding-window limiter. This limits accidental abuse on a single
 * server instance; a shared store should replace it if the API is scaled out.
 */
const events = new Map<string, number[]>();

export function assertRateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const recent = (events.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);
  if (recent.length >= limit) {
    events.set(key, recent);
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Слишком много попыток. Попробуйте позже.",
    });
  }

  recent.push(now);
  events.set(key, recent);

  if (events.size > 10_000) {
    for (const [entryKey, timestamps] of events) {
      if (timestamps.every((timestamp) => now - timestamp >= windowMs)) {
        events.delete(entryKey);
      }
    }
  }
}

/** Returns affectedRows from a Drizzle MySQL update result. */
export function affectedRows(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { affectedRows?: number } | undefined)?.affectedRows ?? 0);
}
