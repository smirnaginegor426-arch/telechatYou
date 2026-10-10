import { TRPCError } from "@trpc/server";

/**
 * Simple in-memory sliding-window limiter. Good enough for a single server
 * instance; resets on restart. Use a shared store if you scale out.
 */
const hits = new Map<string, number[]>();

export function assertRateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Слишком много попыток. Попробуйте позже.",
    });
  }
  recent.push(now);
  hits.set(key, recent);
}

/** Returns affectedRows from a drizzle mysql update result (driver-shape tolerant). */
export function affectedRows(res: unknown): number {
  const header = Array.isArray(res) ? res[0] : res;
  return Number((header as { affectedRows?: number } | undefined)?.affectedRows ?? 0);
}
