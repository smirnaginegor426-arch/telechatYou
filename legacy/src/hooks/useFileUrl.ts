import { useEffect, useState } from "react";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../api/router";

/** Vanilla client for imperative URL resolution without adding hook dependencies. */
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

type CachedUrl = { url: string; expiresAt: number };
type RefreshDetail = { key: string };
const REFRESH_EVENT = "tcy:refresh-file-url";
// Signed storage URLs expire; refresh the local cache before they approach server expiry.
const CACHE_TTL_MS = 7 * 60 * 1000;
const cache = new Map<string, CachedUrl>();
const pending = new Map<string, Promise<string | null>>();

async function resolveKey(key: string, force = false): Promise<string | null> {
  if (force) {
    cache.delete(key);
    pending.delete(key);
  }

  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.url;
  if (hit) cache.delete(key);

  const inFlight = pending.get(key);
  if (inFlight) return inFlight;

  let promise: Promise<string | null>;
  promise = vanilla.storage.urls
    .query({ keys: [key] })
    .then((result) => {
      const url = result.urls[key] ?? null;
      // Do not let an older request overwrite a newer forced refresh.
      if (pending.get(key) === promise) {
        pending.delete(key);
        if (url) cache.set(key, { url, expiresAt: Date.now() + CACHE_TTL_MS });
      }
      return url;
    })
    .catch(() => {
      if (pending.get(key) === promise) pending.delete(key);
      return null;
    });
  pending.set(key, promise);
  return promise;
}

/** Force a fresh URL after an image fails to load. */
export function refreshFileUrl(key: string | null | undefined): void {
  if (!key || typeof window === "undefined") return;
  cache.delete(key);
  pending.delete(key);
  window.dispatchEvent(new CustomEvent<RefreshDetail>(REFRESH_EVENT, { detail: { key } }));
}

/** Resolve object-storage key; cached links are renewed before their expiry. */
export function useFileUrl(key: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    if (!key) return null;
    const cached = cache.get(key);
    return cached && cached.expiresAt > Date.now() ? cached.url : null;
  });

  useEffect(() => {
    if (!key) {
      setUrl(null);
      return;
    }

    let alive = true;
    const load = (force = false) => {
      void resolveKey(key, force).then((nextUrl) => {
        if (alive) setUrl(nextUrl);
      });
    };

    const onRefresh = (event: Event) => {
      const detail = (event as CustomEvent<RefreshDetail>).detail;
      if (detail?.key === key) load(true);
    };
    window.addEventListener(REFRESH_EVENT, onRefresh);

    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      setUrl(cached.url);
    } else {
      setUrl(null);
      load();
    }

    return () => {
      alive = false;
      window.removeEventListener(REFRESH_EVENT, onRefresh);
    };
  }, [key]);

  return url;
}

export function prefetchFileUrls(keys: (string | null | undefined)[]) {
  keys.filter((key): key is string => !!key).forEach((key) => void resolveKey(key));
}
