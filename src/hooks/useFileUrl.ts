import { useEffect, useState } from "react";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../api/router";

/** vanilla (non-hook) client for imperative URL resolution */
const vanilla = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, { ...(init ?? {}), credentials: "include" });
      },
    }),
  ],
});

/** session-level cache: storage key -> presigned url */
const cache = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

async function resolveKey(key: string): Promise<string | null> {
  const hit = cache.get(key);
  if (hit) return hit;
  const p = pending.get(key);
  if (p) return p;
  const promise = vanilla.storage.urls
    .query({ keys: [key] })
    .then((r) => {
      const url = r.urls[key] ?? null;
      if (url) cache.set(key, url);
      pending.delete(key);
      return url;
    })
    .catch(() => {
      pending.delete(key);
      return null;
    });
  pending.set(key, promise);
  return promise;
}

/** Resolve an object-storage key into a renderable URL (cached, ~10 min TTL from server). */
export function useFileUrl(key: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => (key ? cache.get(key) ?? null : null));

  useEffect(() => {
    if (!key) {
      setUrl(null);
      return;
    }
    const hit = cache.get(key);
    if (hit) {
      setUrl(hit);
      return;
    }
    let alive = true;
    resolveKey(key).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [key]);

  return url;
}

export function prefetchFileUrls(keys: (string | null | undefined)[]) {
  keys.filter((k): k is string => !!k).forEach((k) => void resolveKey(k));
}
