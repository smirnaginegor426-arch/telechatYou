import { useEffect, useState } from "react";

const REFRESH_EVENT = "tcy:refresh-file-url";

type RefreshDetail = { key: string; version: number };

// Uploaded objects get unique keys and the authenticated file route is stable.
// Resolve the URL locally instead of making a storage.urls request for every image.
const retryVersions = new Map<string, number>();
let nextRetryVersion = 0;

function fileUrlForKey(key: string): string {
  return `/api/files/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export function refreshFileUrl(key: string | null | undefined): void {
  if (!key || typeof window === "undefined") return;

  const version = ++nextRetryVersion;
  retryVersions.set(key, version);
  window.dispatchEvent(
    new CustomEvent<RefreshDetail>(REFRESH_EVENT, {
      detail: { key, version },
    }),
  );
}

/**
 * A stable URL for a file. The browser caches the bytes itself; no RPC is needed
 * to resolve this URL. Only an actual load error adds a cache-busting version.
 */
export function useFileUrl(key: string | null | undefined): string | null {
  const [retryState, setRetryState] = useState<{ key: string | null | undefined; version: number }>(
    () => ({ key, version: key ? retryVersions.get(key) ?? 0 : 0 }),
  );
  const retryVersion = retryState.key === key
    ? retryState.version
    : key
      ? retryVersions.get(key) ?? 0
      : 0;

  useEffect(() => {
    if (!key || typeof window === "undefined") return;

    // Pick up a retry requested before this component mounted.
    setRetryState({ key, version: retryVersions.get(key) ?? 0 });

    const onRefresh = (event: Event) => {
      const detail = (event as CustomEvent<RefreshDetail>).detail;
      if (detail?.key === key) setRetryState({ key, version: detail.version });
    };

    window.addEventListener(REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(REFRESH_EVENT, onRefresh);
  }, [key]);

  if (!key) return null;
  const baseUrl = fileUrlForKey(key);
  return retryVersion > 0 ? `${baseUrl}?tcy_retry=${retryVersion}` : baseUrl;
}

/** Kept as a no-op-free compatibility helper for existing prefetch call sites. */
export function prefetchFileUrls(keys: (string | null | undefined)[]): void {
  // Computing the stable URLs is synchronous; there is nothing to fetch in advance.
  for (const key of keys) {
    if (key) fileUrlForKey(key);
  }
}
