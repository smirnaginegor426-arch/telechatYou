
import { useEffect, useState } from "react";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../api/router";

// Временные ссылки обновляются заранее, пока они ещё действительны.
const REFRESH_AFTER_MS = 6 * 60 * 1000;

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

type CachedUrl = {
  url: string;
  createdAt: number;
};

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

export function useFileUrl(
  key: string | null | undefined,
): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    if (!key) return null;
    return cache.get(key)?.url ?? null;
  });

  useEffect(() => {
    if (!key) {
      setUrl(null);
      return;
    }

    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function load(forceRefresh = false) {
      const nextUrl = await resolveKey(key!, forceRefresh);

      if (!alive) return;

      if (nextUrl) {
        setUrl(nextUrl);

        // Обновляем URL заранее, не дожидаясь ошибки загрузки.
        timer = setTimeout(() => {
          void load(true);
        }, REFRESH_AFTER_MS);
      } else {
        setUrl(null);
      }
    }

    void load();

    return () => {
      alive = false;

      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [key]);

  return url;
}

export function prefetchFileUrls(
  keys: (string | null | undefined)[],
) {
  keys
    .filter((key): key is string => Boolean(key))
    .forEach((key) => {
      void resolveKey(key);
    });
}
