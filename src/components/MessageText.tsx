import { Fragment, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { EmojiText } from "@/components/AppleEmoji";

function trimLinkPunctuation(value: string) {
  let end = value.length;
  while (end > 0 && /[.,!?;:]/.test(value[end - 1])) end--;

  // A closing parenthesis belongs to the URL only when it has a matching opener.
  while (end > 0 && value[end - 1] === ")") {
    const candidate = value.slice(0, end);
    const opens = (candidate.match(/\(/g) ?? []).length;
    const closes = (candidate.match(/\)/g) ?? []).length;
    if (closes <= opens) break;
    end--;
  }

  return { url: value.slice(0, end), punctuation: value.slice(end) };
}

function internalAppPath(href: string): string | null {
  try {
    const url = new URL(href);
    const host = url.hostname.toLowerCase();
    const currentHost = typeof window === "undefined" ? "" : window.location.hostname.toLowerCase();
    const isMessengerHost =
      host === "telechatyou.app" ||
      host === "telechatyou-1.onrender.com" ||
      host === currentHost;

    if (!isMessengerHost) return null;

    const path = url.pathname.replace(/\/$/, "");
    if (/^\/@[a-zA-Z0-9_]{3,32}$/.test(path)) return path;
    if (/^\/chat\/\d+$/.test(path)) return path;
    if (/^\/user\/\d+$/.test(path)) return path;
    return null;
  } catch {
    return null;
  }
}

/** Renders URLs as blue links and keeps TeleChat You links inside the current app instance. */
export function MessageText({ text }: { text: string }) {
  const navigate = useNavigate();
  const nodes: ReactNode[] = [];
  const urlPattern = /https?:\/\/[^\s<>"'`]+/gi;
  let cursor = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = urlPattern.exec(text)) !== null) {
    const raw = match[0];
    const start = match.index;
    const { url, punctuation } = trimLinkPunctuation(raw);

    if (!url) continue;
    if (start > cursor) {
      nodes.push(<EmojiText key={`text-${index++}`} text={text.slice(cursor, start)} />);
    }

    const path = internalAppPath(url);
    nodes.push(
      <Fragment key={`link-${index++}`}>
        <a
          href={url}
          target={path ? undefined : "_blank"}
          rel={path ? undefined : "noopener noreferrer"}
          onClick={path ? (event) => {
            event.preventDefault();
            const parsed = new URL(url);
            navigate(path + parsed.search + parsed.hash);
          } : undefined}
          className="underline underline-offset-2 break-all"
          style={{ color: "#2787f5", cursor: "pointer" }}
        >
          {url}
        </a>
        {punctuation}
      </Fragment>,
    );
    cursor = start + raw.length;
  }

  if (cursor < text.length) {
    nodes.push(<EmojiText key={`text-${index++}`} text={text.slice(cursor)} />);
  }

  if (nodes.length === 0) return <EmojiText text={text} />;
  return <>{nodes}</>;
}
