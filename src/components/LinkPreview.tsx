import { useState } from "react";
import { trpc } from "@/providers/trpc";

const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/i;

/** First http(s) link in a message body, minus trailing punctuation. */
export function firstUrlInText(text: string): string | null {
  const match = text.match(URL_PATTERN);
  if (!match) return null;
  let url = match[0];
  while (url.length > 0 && /[.,!?;:)\]]$/.test(url)) url = url.slice(0, -1);
  return url.length > 0 ? url : null;
}

/**
 * Link preview card shown under the link inside the same message bubble.
 * Private experimental feature: the metadata comes from the server unfurl.
 */
export function LinkPreview({
  text,
  own,
  enabled,
}: {
  text: string;
  own: boolean;
  enabled: boolean;
}) {
  const url = enabled ? firstUrlInText(text) : null;
  const [imageBroken, setImageBroken] = useState(false);
  const query = trpc.links.preview.useQuery(
    { url: url ?? "" },
    {
      enabled: Boolean(url),
      staleTime: 1000 * 60 * 30,
      gcTime: 1000 * 60 * 60,
      retry: false,
      refetchOnWindowFocus: false,
    },
  );

  const data = query.data;
  if (!url || !data || (!data.title && !data.description && !data.image)) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 block w-[264px] max-w-full overflow-hidden rounded-[14px] border tcy-line no-underline"
      style={{
        background: own
          ? "color-mix(in srgb, var(--tcy-bubble-own-fg) 10%, transparent)"
          : "var(--tcy-card)",
        color: own ? "var(--tcy-bubble-own-fg)" : "var(--tcy-text)",
      }}
    >
      {data.image && !imageBroken && (
        <img
          src={data.image}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setImageBroken(true)}
          className="block h-[132px] w-full object-cover"
        />
      )}
      <span className="block px-3 py-2">
        <span
          className="block truncate text-[11px] font-bold"
          style={{ color: own ? "var(--tcy-bubble-own-muted)" : "var(--tcy-accent)" }}
        >
          {data.siteName ?? data.host}
        </span>
        {data.title && (
          <span
            className="mt-0.5 block text-[13px] leading-snug font-bold"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {data.title}
          </span>
        )}
        {data.description && (
          <span
            className="mt-0.5 block text-[11.5px] leading-snug"
            style={{
              color: own ? "var(--tcy-bubble-own-muted)" : "var(--tcy-dim)",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {data.description}
          </span>
        )}
      </span>
    </a>
  );
}
