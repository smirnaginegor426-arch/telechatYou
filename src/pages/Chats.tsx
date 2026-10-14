import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Archive, MessageCirclePlus, MessagesSquare, Search } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { ChatItem } from "@/components/ChatItem";
import { Logo, Wordmark } from "@/components/Logo";
import { EmptyState } from "@/components/EmptyState";
import { TcButton } from "@/components/TcButton";
import { Lightbox } from "@/components/Lightbox";

function ChatSkeleton() {
  return (
    <div className="flex items-center gap-3.5 px-4 py-3">
      <div className="tcy-skeleton w-[54px] h-[54px] rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="tcy-skeleton h-3.5 rounded-full w-2/5" />
        <div className="tcy-skeleton h-3 rounded-full w-3/5" />
      </div>
    </div>
  );
}

export default function Chats() {
  const navigate = useNavigate();
  const [avatarPreview, setAvatarPreview] = useState<{ key: string | null; name: string; username?: string | null } | null>(null);
  const utils = trpc.useUtils();
  const [showArchived, setShowArchived] = useState(false);
  const [brandPhase, setBrandPhase] = useState<"connecting" | "updating" | "ready">("connecting");

  useEffect(() => {
    // Ask the browser to refresh the current location on entry. Coordinates are
    // deliberately not stored or sent to our server; this check only drives the status animation.
    let cancelled = false;
    let completed = false;
    const timers: number[] = [];
    const startedAt = Date.now();
    let fallbackTimer: number | undefined;

    const finishLocationCheck = () => {
      if (cancelled || completed) return;
      completed = true;
      if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer);

      // Keep "Соединение…" visible long enough to read, even if geolocation answers quickly.
      const delay = Math.max(0, 1250 - (Date.now() - startedAt));
      timers.push(window.setTimeout(() => {
        if (cancelled) return;
        setBrandPhase("updating");
        timers.push(window.setTimeout(() => {
          if (!cancelled) setBrandPhase("ready");
        }, 1050));
      }, delay));
    };

    if (!("geolocation" in navigator)) {
      timers.push(window.setTimeout(finishLocationCheck, 900));
    } else {
      // A timeout prevents the header from staying in a loading state indefinitely
      // if the person declines the permission request or the device can't locate them.
      fallbackTimer = window.setTimeout(finishLocationCheck, 4000);
      navigator.geolocation.getCurrentPosition(
        () => finishLocationCheck(),
        () => finishLocationCheck(),
        { enableHighAccuracy: false, maximumAge: 0, timeout: 3500 },
      );
    }

    return () => {
      cancelled = true;
      if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  const list = trpc.chats.list.useQuery(undefined, {
    refetchInterval: 4000,
    refetchIntervalInBackground: false,
  });

  const invalidate = () => utils.chats.list.invalidate();
  const flags = trpc.chats.setFlags.useMutation({ onSuccess: invalidate });
  const remove = trpc.chats.remove.useMutation({ onSuccess: invalidate });
  const markRead = trpc.chats.markRead.useMutation({ onSuccess: invalidate });

  const items = list.data ?? [];
  const active = items.filter((i) => !i.membership.archived);
  const archived = items.filter((i) => i.membership.archived);
  const shown = showArchived ? archived : active;
  const archivedUnread = archived.reduce((s, i) => s + i.unread, 0);

  const actions = useMemo(
    () => ({
      onPin: (id: number, pinned: boolean) =>
        flags.mutate({ chatId: id, pinned: !pinned }),
      onMute: (id: number, muted: boolean) =>
        flags.mutate({ chatId: id, muted: !muted }),
      onRead: (id: number) => markRead.mutate({ chatId: id }),
      onDelete: (id: number, archivedFlag: boolean) => {
        if (archivedFlag) flags.mutate({ chatId: id, archived: false });
        else remove.mutate({ chatId: id, leave: false });
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div className="relative h-full flex flex-col">
      {/* header */}
      <header className="relative z-10 px-5 pt-5 safe-top pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo size={34} />
            {brandPhase === "ready" ? (
              <Wordmark />
            ) : (
              <motion.div
                key={brandPhase}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="flex items-center font-extrabold tracking-tight text-[18px] tcy-text select-none"
                aria-live="polite"
                aria-label={brandPhase === "connecting" ? "Соединение" : "Обновление"}
              >
                <span>{brandPhase === "connecting" ? "Соединение" : "Обновление"}</span>
                <span className="ml-1.5 inline-flex items-center gap-[3px]" aria-hidden="true">
                  {[0, 1, 2].map((dot) => (
                    <motion.span
                      key={dot}
                      className="inline-block h-[4px] w-[4px] rounded-full tcy-accent-bg"
                      animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
                      transition={{
                        duration: 0.8,
                        delay: dot * 0.15,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                  ))}
                </span>
              </motion.div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/search")}
              className="tcy-press w-10 h-10 rounded-full tcy-card border tcy-line flex items-center justify-center tcy-dim"
              aria-label="Поиск"
            >
              <Search size={18} />
            </button>
            <button
              onClick={() => navigate("/new")}
              className="tcy-press w-10 h-10 rounded-full tcy-gradient-accent tcy-shadow-accent flex items-center justify-center"
              style={{ color: "var(--tcy-on-accent)" }}
              aria-label="Новый чат"
            >
              <MessageCirclePlus size={19} />
            </button>
          </div>
        </div>
        <button
          onClick={() => navigate("/search")}
          className="mt-4 w-full h-11 rounded-[18px] tcy-card border tcy-line flex items-center gap-3 px-4 text-left tcy-press"
        >
          <Search size={16} className="tcy-faint" />
          <span className="text-[13.5px] tcy-faint font-medium">Поиск чатов, людей, сообщений…</span>
        </button>
      </header>

      {/* archived entry */}
      {!showArchived && archived.length > 0 && (
        <button
          onClick={() => setShowArchived(true)}
          className="mx-4 mb-1 flex items-center gap-3 px-4 py-3 rounded-[18px] tcy-card border tcy-line tcy-press"
        >
          <Archive size={17} className="tcy-dim" />
          <span className="text-[13.5px] font-semibold tcy-dim flex-1 text-left">Архив</span>
          {archivedUnread > 0 && (
            <span className="text-[11.5px] font-bold tcy-accent">{archivedUnread} новых</span>
          )}
        </button>
      )}
      {showArchived && (
        <button
          onClick={() => setShowArchived(false)}
          className="mx-4 mb-1 flex items-center gap-3 px-4 py-2.5 tcy-press"
        >
          <span className="text-[13px] font-bold tcy-accent">← К чатам</span>
        </button>
      )}

      {/* built-in official bot */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-28 relative z-10">
        {!showArchived && (
          <button
            type="button"
            onClick={() => navigate("/chat/telechatyou")}
            className="w-full flex items-center gap-3.5 px-4 py-3 text-left tcy-bg active:bg-[color:var(--tcy-card)] transition-colors"
          >
            <img
              src="/telechatyou-bot-avatar.svg"
              alt=""
              draggable={false}
              className="w-[54px] h-[54px] shrink-0 object-cover rounded-[30%]"
            />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[15.5px] tcy-text truncate flex items-center gap-2">
                <span>TeleChatYou</span>
                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md tcy-gradient-accent" style={{ color: "var(--tcy-on-accent)" }}>BOT</span>
              </div>
              <div className="text-[13.5px] tcy-dim truncate mt-0.5">Официальный бот · напишите start</div>
            </div>
          </button>
        )}
        {list.isLoading ? (
          <div className="pt-1">
            {[...Array(6)].map((_, i) => (
              <ChatSkeleton key={i} />
            ))}
          </div>
        ) : list.isError ? (
          <EmptyState
            icon={<MessagesSquare size={34} />}
            title="Не удалось загрузить чаты"
            hint="Проверьте подключение к сети и попробуйте ещё раз."
            action={<TcButton onClick={() => list.refetch()}>Повторить</TcButton>}
          />
        ) : shown.length === 0 ? (
          <EmptyState
            icon={<MessagesSquare size={34} />}
            title={showArchived ? "Архив пуст" : "Пока нет чатов"}
            hint={
              showArchived
                ? "Здесь появятся заархивированные диалоги."
                : "Найдите друга по username и начните общение — это займёт пару секунд."
            }
            action={
              !showArchived ? (
                <TcButton onClick={() => navigate("/contacts")}>Найти людей</TcButton>
              ) : undefined
            }
          />
        ) : (
          <div className="divide-y divide-[color:var(--tcy-line)]">
            {shown.map((item, i) => (
              <motion.div
                key={item.chat.id}
                exit={{ opacity: 0, x: -60 }}
                layout="position"
              >
                <ChatItem
                  item={item}
                  index={i}
                  onClick={() => navigate(`/chat/${item.chat.id}`)}
                  onAvatarClick={() => {
                    const direct = item.chat.type === "direct";
                    setAvatarPreview({
                      key: (direct ? item.peer?.avatarKey : item.chat.avatarKey) ?? null,
                      name: direct ? item.peer?.displayName ?? "Пользователь" : item.chat.title ?? "Группа",
                      username: direct && item.peer?.username ? `@${item.peer.username}` : null,
                    });
                  }}
                  onPin={() => actions.onPin(item.chat.id, item.membership.pinned)}
                  onMute={() => actions.onMute(item.chat.id, item.membership.muted)}
                  onRead={() => actions.onRead(item.chat.id)}
                  onDelete={() => actions.onDelete(item.chat.id, showArchived)}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>
      <Lightbox
        imageKey={avatarPreview?.key ?? null}
        name={avatarPreview?.name}
        subtitle={avatarPreview?.username}
        fallbackName={avatarPreview && !avatarPreview.key ? avatarPreview.name : null}
        onClose={() => setAvatarPreview(null)}
      />
    </div>
  );
}
