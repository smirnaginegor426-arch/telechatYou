import { useState } from "react";
import type { MouseEvent } from "react";
import { useNavigate } from "react-router";
import { ChevronRight, Link as LinkIcon } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Logo } from "./Logo";
import { Avatar } from "./Avatar";

const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/i;

/** First http(s) link in a message body, minus trailing punctuation. */
export function firstUrlInText(text: string): string | null {
  const match = text.match(URL_PATTERN);
  if (!match) return null;
  let url = match[0];
  while (url.length > 0 && /[.,!?;:)\]]$/.test(url)) url = url.slice(0, -1);
  return url.length > 0 ? url : null;
}

type AppLink =
  | { kind: "invite"; token: string; path: string }
  | { kind: "channel"; username: string; path: string }
  | { kind: "chat"; chatId: number; path: string }
  | { kind: "user"; userId: number; path: string };

/**
 * Links that point at TeleChatYou itself. Those never go to the web unfurl:
 * the card is branded from the app's own data, so it is obvious the link opens
 * the messenger and not some third-party site.
 */
export function parseAppLink(raw: string): AppLink | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const here =
    typeof window === "undefined" ? "" : window.location.hostname.toLowerCase().replace(/^www\./, "");
  if (host !== "telechatyou.app" && host !== "telechatyou-1.onrender.com" && host !== here) {
    return null;
  }

  const path = url.pathname.replace(/\/+$/, "") || "/";
  const invite = /^\/invite\/([A-Za-z0-9_-]{6,80})$/.exec(path);
  if (invite) return { kind: "invite", token: invite[1], path };
  const chat = /^\/chat\/(\d+)$/.exec(path);
  if (chat) return { kind: "chat", chatId: Number(chat[1]), path };
  const username = /^\/@([a-zA-Z0-9_]{3,32})$/.exec(path);
  if (username) return { kind: "channel", username: username[1].toLowerCase(), path };
  const user = /^\/user\/(\d+)$/.exec(path);
  if (user) return { kind: "user", userId: Number(user[1]), path };
  return null;
}

/**
 * Link preview card shown under a link inside the same message bubble.
 * TeleChat You links use app data; external links use server-fetched page metadata.
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
  const navigate = useNavigate();
  const [imageBroken, setImageBroken] = useState(false);
  const url = enabled ? firstUrlInText(text) : null;
  const appLink = url ? parseAppLink(url) : null;

  const unfurl = trpc.links.preview.useQuery(
    { url: url ?? "" },
    {
      enabled: Boolean(url) && !appLink,
      staleTime: 1000 * 60 * 30,
      gcTime: 1000 * 60 * 60,
      retry: false,
      refetchOnWindowFocus: false,
    },
  );

  const invite = trpc.channels.invitePreview.useQuery(
    { token: appLink?.kind === "invite" ? appLink.token : "invite0000" },
    { enabled: appLink?.kind === "invite", retry: false, staleTime: 1000 * 60 * 5 },
  );

  const channel = trpc.channels.byUsername.useQuery(
    { username: appLink?.kind === "channel" ? appLink.username : "tcy" },
    { enabled: appLink?.kind === "channel", retry: false, staleTime: 1000 * 60 * 5 },
  );

  // A shared /@username URL can point to either a user profile or a public channel.
  // Resolve both; the app's normal route will open the right destination.
  const profile = trpc.profile.byUsername.useQuery(
    { username: appLink?.kind === "channel" ? appLink.username : "tcy" },
    { enabled: appLink?.kind === "channel", retry: false, staleTime: 1000 * 60 * 5 },
  );

  const userProfile = trpc.profile.byId.useQuery(
    { userId: appLink?.kind === "user" ? appLink.userId : 0 },
    { enabled: appLink?.kind === "user", retry: false, staleTime: 1000 * 60 * 5 },
  );

  const chats = trpc.chats.list.useQuery(undefined, { enabled: appLink?.kind === "chat" });

  if (!url) return null;

  const surface = own
    ? "color-mix(in srgb, var(--tcy-bubble-own-fg) 10%, transparent)"
    : "var(--tcy-card)";
  const frontColor = own ? "var(--tcy-bubble-own-fg)" : "var(--tcy-text)";
  const mutedColor = own ? "var(--tcy-bubble-own-muted)" : "var(--tcy-dim)";

  const openInApp = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!appLink) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (appLink.kind === "channel" && !profile.data) navigate(`${appLink.path}?open=1`);
    else navigate(appLink.path);
  };

  if (appLink) {
    const linkedProfile =
      appLink.kind === "channel"
        ? profile.data
        : appLink.kind === "user"
          ? userProfile.data
          : undefined;

    // Keep profile links in the same avatar + name + username + bio layout
    // even while the profile query is loading or the account has no photo.
    const isProfileLink = appLink.kind === "user" || appLink.kind === "channel";
    const isKnownChannel = appLink.kind === "channel" && !linkedProfile && !!channel.data;
    if (isProfileLink && !isKnownChannel) {
      const username = linkedProfile?.username ?? (appLink.kind === "channel" ? appLink.username : "");
      const displayName = linkedProfile?.displayName ?? (username ? `@${username}` : "Профиль пользователя");
      const description = linkedProfile?.bio?.trim() || "Описание не добавлено";
      return (
        <a
          href={url}
          onClick={openInApp}
          className="mt-2 block w-[280px] max-w-full overflow-hidden rounded-[14px] border tcy-line no-underline"
          style={{ background: surface, color: frontColor }}
        >
          <span className="block px-3 py-3">
            <span className="flex min-w-0 items-center gap-3">
              <Avatar
                name={displayName}
                avatarKey={linkedProfile?.avatarKey}
                size={56}
                className="shrink-0"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] leading-snug font-bold">
                  {displayName}
                </span>
                <span className="mt-1 block truncate text-[11.5px]" style={{ color: mutedColor }}>
                  {username ? `@${username}` : " "}
                </span>
              </span>
            </span>
            <span
              className="mt-2.5 block text-[11.5px] leading-snug"
              style={{
                color: mutedColor,
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                overflowWrap: "anywhere",
              }}
            >
              {description}
            </span>
          </span>
        </a>
      );
    }

    const info = (() => {
      if (appLink.kind === "invite") {
        const data = invite.data;
        return {
          chip: data ? (data.kind === "group" ? "Группа" : "Канал") : "Приглашение",
          title: data?.title ?? "Ссылка-приглашение",
          subtitle: data
            ? `Участников: ${data.membersCount}${data.joined ? " · вы уже здесь" : ""}`
            : "Нажмите, чтобы открыть в приложении",
        };
      }
      if (appLink.kind === "channel") {
        const person = profile.data;
        if (person) {
          return {
            chip: "Профиль",
            title: person.displayName,
            subtitle: `@${person.username} · профиль TeleChat You`,
          };
        }

        const data = channel.data;
        return {
          chip: data ? (data.kind === "group" ? "Группа" : "Канал") : "Канал",
          title: data?.title ?? `@${appLink.username}`,
          subtitle: data ? `@${data.username} · участников: ${data.membersCount}` : "Публичный канал",
        };
      }
      if (appLink.kind === "chat") {
        const found = chats.data?.find((item) => item.chat.id === appLink.chatId);
        return {
          chip: found?.channel ? "Канал" : "Чат",
          title: found?.chat.title ?? "Открыть чат",
          subtitle: "Чат в TeleChatYou",
        };
      }
      const person = userProfile.data;
      return {
        chip: "Профиль",
        title: person?.displayName ?? "Профиль пользователя",
        subtitle: person ? `@${person.username} · открыть в TeleChatYou` : "Открыть в TeleChatYou",
      };
    })();

    return (
      <a
        href={url}
        onClick={openInApp}
        className="mt-2 block w-[280px] max-w-full overflow-hidden rounded-[14px] border tcy-line no-underline"
        style={{ background: surface, color: frontColor }}
      >
        <span className="flex items-start gap-3 px-3 py-3">
          {(appLink.kind === "channel" || appLink.kind === "user") ? (
            <Avatar
              name={linkedProfile?.displayName ?? (appLink.kind === "channel" ? appLink.username : "Профиль")}
              avatarKey={linkedProfile?.avatarKey ?? null}
              size={56}
              className="shrink-0"
            />
          ) : (
            <span
              className="grid size-[36px] shrink-0 place-items-center rounded-[11px]"
              style={{
                background: own
                  ? "color-mix(in srgb, var(--tcy-bubble-own-fg) 12%, transparent)"
                  : "color-mix(in srgb, var(--tcy-accent) 14%, transparent)",
              }}
            >
              <Logo size={24} />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="shrink-0 text-[12px] font-black tracking-tight">TeleChatYou</span>
              <span
                className="shrink-0 rounded-[5px] px-1 py-[1px] text-[9px] font-bold uppercase tracking-wide"
                style={{
                  background: own
                    ? "color-mix(in srgb, var(--tcy-bubble-own-fg) 16%, transparent)"
                    : "color-mix(in srgb, var(--tcy-accent) 16%, transparent)",
                  color: own ? "var(--tcy-bubble-own-fg)" : "var(--tcy-accent)",
                }}
              >
                {info.chip}
              </span>
            </span>
            <span className="mt-[1px] block truncate text-[13px] leading-snug font-bold">
              {info.title}
            </span>
            <span className="block truncate text-[11px]" style={{ color: mutedColor }}>
              {info.subtitle}
            </span>
          </span>
          <ChevronRight size={16} className="shrink-0" style={{ color: mutedColor }} />
        </span>
      </a>
    );
  }

  const data = unfurl.data;
  if (!data || (!data.title && !data.description && !data.image)) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 block w-[264px] max-w-full overflow-hidden rounded-[14px] border tcy-line no-underline"
      style={{ background: surface, color: frontColor }}
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
      <span className="flex items-start gap-2.5 px-3 py-2">
        <span
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-[10px]"
          style={{
            background: own
              ? "color-mix(in srgb, var(--tcy-bubble-own-fg) 12%, transparent)"
              : "color-mix(in srgb, var(--tcy-accent) 12%, transparent)",
            color: own ? "var(--tcy-bubble-own-fg)" : "var(--tcy-accent)",
          }}
          aria-hidden="true"
        >
          <img
            src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(data.host)}&sz=64`}
            alt=""
            className="size-5 object-contain"
            onError={(event) => {
              event.currentTarget.style.display = "none";
              const fallback = event.currentTarget.nextElementSibling as HTMLElement | null;
              if (fallback) fallback.style.display = "block";
            }}
          />
          <LinkIcon size={19} style={{ display: "none" }} />
        </span>
        <span className="block min-w-0 flex-1">
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
      </span>
    </a>
  );
}
