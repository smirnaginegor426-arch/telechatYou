
import { useEffect, useState } from "react";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../api/router";

const REFRESH_AFTER_MS = 4 * 60 * 1000;
const RETRY_AFTER_MS = 30 * 1000;
const REFRESH_EVENT = "tcy:refresh-file-url";

type CachedUrl = {
  url: string;
  createdAt: number;
};

const vanilla = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

const cache = new Map<string, CachedUrl>();
const pending = new Map<string, Promise<string | null>>();

async function resolveKey(
  key: string,
  forceRefresh = false,
): Promise<string | null> {
  const hit = cache.get(key);

  if (
    !forceRefresh &&
    hit &&
    Date.now() - hit.createdAt < REFRESH_AFTER_MS
  ) {
    return hit.url;
  }

  const existing = pending.get(key);
  if (existing) return existing;

  cache.delete(key);

  const promise = vanilla.storage.urls
    .query({ keys: [key] })
    .then((result) => {
      const url = result.urls[key] ?? null;

      if (url) {
        cache.set(key, {
          url,
          createdAt: Date.now(),
        });
      }

      return url;
    })
    .catch(() => null)
    .finally(() => {
      pending.delete(key);
    });

  pending.set(key, promise);
  return promise;
}

export function refreshFileUrl(
  key: string | null | undefined,
): void {
  if (!key || typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(REFRESH_EVENT, {
      detail: { key },
    }),
  );
}

export function useFileUrl(
  key: string | null | undefined,
): string | null {
  const [url, setUrl] = useState<string | null>(
    () => (key ? cache.get(key)?.url ?? null : null),
  );

  useEffect(() => {
    if (!key) {
      setUrl(null);
      return;
    }

    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    setUrl(cache.get(key)?.url ?? null);

    function schedule(delay: number) {
      if (timer) clearTimeout(timer);

      timer = setTimeout(() => {
        void load(true);
      }, delay);
    }

    async function load(forceRefresh = false) {
      const nextUrl = await resolveKey(key!, forceRefresh);

      if (!alive) return;

      if (nextUrl) {
        setUrl(nextUrl);
        schedule(REFRESH_AFTER_MS);
      } else {
        // If URL lookup temporarily fails, retry instead of leaving media permanently blank.
        schedule(RETRY_AFTER_MS);
      }
    }

    function onRefresh(event: Event) {
      const detail = (event as CustomEvent<{ key: string }>).detail;
      if (detail?.key !== key) return;

      // Force the image/audio element to remount after a network or storage error.
      // The URL itself is stable (/api/files/<key>), so refreshing only the cache
      // without changing the state would not make the browser retry the request.
      setUrl(null);
      if (timer) clearTimeout(timer);
      void load(true);
    }

    window.addEventListener(REFRESH_EVENT, onRefresh);
    void load();

    return () => {
      alive = false;

      if (timer) clearTimeout(timer);

      window.removeEventListener(REFRESH_EVENT, onRefresh);
    };
  }, [key]);

  return url;
}

export function prefetchFileUrls(
  keys: (string | null | undefined)[],
) {
  keys
    .filter((key): key is string => Boolean(key))
    .forEach((key) => void resolveKey(key));
}
