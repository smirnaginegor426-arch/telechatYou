import { Fragment, useRef, useState, type ReactNode, type MouseEvent } from "react";
import { useNavigate } from "react-router";
import { EmojiText } from "@/components/AppleEmoji";
import { trpc } from "@/providers/trpc";

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

/**
 * An @username mention opens a direct chat with a user or opens a public
 * channel/group. It falls back to the public @username page if needed.
 */
function UsernameMentionLink({ username, label }: { username: string; label: string }) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const createDirect = trpc.chats.createDirect.useMutation();
  const joinPublic = trpc.channels.joinPublic.useMutation();
  const openingRef = useRef(false);
  const [opening, setOpening] = useState(false);

  const openMention = async (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (openingRef.current) return;

    openingRef.current = true;
    setOpening(true);
    let destination = `/@${username}`;
    let profileFound = false;

    try {
      try {
        const profile = await utils.profile.byUsername.fetch({ username });
        profileFound = true;
        const result = await createDirect.mutateAsync({ userId: profile.userId });
        void utils.chats.list.invalidate();
        destination = `/chat/${result.chatId}`;
      } catch {
        // Only try a channel lookup when there is no profile for this username.
        if (!profileFound) {
          try {
            await utils.channels.byUsername.fetch({ username });
            const result = await joinPublic.mutateAsync({ username });
            void utils.chats.list.invalidate();
            destination = `/chat/${result.chatId}`;
          } catch {
            // Keep the public @username page as a safe fallback.
          }
        }
      }
    } finally {
      openingRef.current = false;
      setOpening(false);
      navigate(destination);
    }
  };

  return (
    <a
      href={`/@${username}`}
      onClick={openMention}
      aria-busy={opening}
      title={`Открыть ${label}`}
      className="font-semibold underline-offset-2 hover:underline"
      style={{ color: "#2787f5", cursor: "pointer", opacity: opening ? 0.72 : 1 }}
    >
      {label}
    </a>
  );
}

/** Renders URLs and @username mentions as blue links inside the messenger. */
export function MessageText({ text }: { text: string }) {
  const navigate = useNavigate();
  const nodes: ReactNode[] = [];
  const tokenPattern = /https?:\/\/[^\s<>"'`]+|@[a-zA-Z0-9_]{3,32}(?![a-zA-Z0-9_])/gi;
  let cursor = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = tokenPattern.exec(text)) !== null) {
    const raw = match[0];
    const start = match.index;

    // Do not turn the domain part of an email address into an app username.
    if (raw.startsWith("@") && start > 0 && /[a-zA-Z0-9._%+-]/.test(text[start - 1])) {
      continue;
    }

    if (start > cursor) {
      nodes.push(<EmojiText key={`text-${index++}`} text={text.slice(cursor, start)} />);
    }

    if (raw.startsWith("@")) {
      const username = raw.slice(1).toLowerCase();
      nodes.push(
        <UsernameMentionLink
          key={`mention-${index++}`}
          username={username}
          label={raw}
        />,
      );
      cursor = start + raw.length;
      continue;
    }

    const { url, punctuation } = trimLinkPunctuation(raw);
    if (!url) continue;
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
