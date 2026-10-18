import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";

/**
 * Link previews for authenticated TeleChat You users.
 *
 * The server fetches external pages once, extracts Open Graph metadata and
 * caches the result. Requests to private/loopback hosts are rejected so a link
 * inside a chat cannot be used to probe the internal network (SSRF).
 */

export type LinkPreview = {
  url: string;
  host: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
};

const TTL = 1000 * 60 * 30;
const MAX_BYTES = 200_000;
const MAX_CACHE = 400;
const cache = new Map<string, { at: number; value: LinkPreview }>();

function emptyPreview(url: string, host: string): LinkPreview {
  return { url, host, title: null, description: null, image: null, siteName: null };
}

function isBlockedHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return true;
  }
  if (host === "::1" || host === "0.0.0.0") return true;
  if (/^f[cd][0-9a-f]{2}:/.test(host)) return true; // unique local IPv6
  if (/^fe80:/.test(host)) return true; // link-local IPv6

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  return false;
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ");
}

function metaContent(html: string, names: string[]) {
  for (const name of names) {
    const tag = html.match(
      new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, "i"),
    )?.[0];
    if (!tag) continue;
    const content = tag.match(/content=["']([^"']*)["']/i)?.[1];
    if (content?.trim()) return decodeEntities(content.trim());
  }
  return null;
}

function pageTitle(html: string) {
  const og = metaContent(html, ["og:title", "twitter:title"]);
  if (og) return og;
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (!title) return null;
  return decodeEntities(title.replace(/\s+/g, " ").trim());
}

function absolute(raw: string | null, base: URL) {
  if (!raw) return null;
  try {
    const url = new URL(raw, base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function fetchPage(parsed: URL): Promise<LinkPreview> {
  const host = parsed.hostname.replace(/^www\./, "");
  const base = emptyPreview(parsed.toString(), host);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);

  try {
    // Validate every redirect destination instead of following redirects blindly.
    // This prevents an allowed public URL from redirecting the preview fetch to
    // localhost or a private network address.
    let target = parsed;
    let response: Response | null = null;
    for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
      if (
        (target.protocol !== "http:" && target.protocol !== "https:") ||
        isBlockedHost(target.hostname)
      ) {
        return base;
      }

      response = await fetch(target.toString(), {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; TeleChatYouBot/1.0)",
          accept: "text/html,application/xhtml+xml",
          "accept-language": "ru,en;q=0.8",
        },
      });

      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get("location");
      if (!location || redirectCount === 3) {
        await response.body?.cancel().catch(() => undefined);
        return base;
      }

      let next: URL;
      try {
        next = new URL(location, target);
      } catch {
        await response.body?.cancel().catch(() => undefined);
        return base;
      }
      await response.body?.cancel().catch(() => undefined);
      target = next;
    }

    if (!response || !response.ok) return base;
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("html")) return base;

    let html = "";
    const reader = response.body?.getReader();
    if (reader) {
      const decoder = new TextDecoder();
      let bytes = 0;
      while (bytes < MAX_BYTES) {
        const chunk = await reader.read();
        if (chunk.done) break;
        if (!chunk.value) continue;
        bytes += chunk.value.byteLength;
        html += decoder.decode(chunk.value, { stream: true });
      }
      await reader.cancel().catch(() => undefined);
    } else {
      html = (await response.text()).slice(0, MAX_BYTES);
    }

    const image = absolute(
      metaContent(html, ["og:image:secure_url", "og:image", "og:image:url", "twitter:image"]),
      target,
    );
    return {
      url: parsed.toString(),
      host,
      title: pageTitle(html)?.slice(0, 160) ?? null,
      description:
        metaContent(html, ["og:description", "twitter:description", "description"])?.slice(0, 300) ??
        null,
      image,
      siteName: metaContent(html, ["og:site_name"])?.slice(0, 80) ?? host,
    };
  } catch {
    return base;
  } finally {
    clearTimeout(timer);
  }
}

export const linksRouter = createRouter({
  preview: authedQuery
    .input(z.object({ url: z.string().trim().min(4).max(2048) }))
    .query(async ({ input }): Promise<LinkPreview> => {
      let parsed: URL;
      try {
        parsed = new URL(input.url);
      } catch {
        return emptyPreview(input.url, "");
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return emptyPreview(parsed.toString(), parsed.hostname);
      }
      if (isBlockedHost(parsed.hostname)) {
        return emptyPreview(parsed.toString(), parsed.hostname);
      }

      const key = parsed.toString();
      const cached = cache.get(key);
      if (cached && Date.now() - cached.at < TTL) return cached.value;

      const value = await fetchPage(parsed);
      cache.set(key, { at: Date.now(), value });
      if (cache.size > MAX_CACHE) {
        const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (oldest) cache.delete(oldest[0]);
      }
      return value;
    }),
});
