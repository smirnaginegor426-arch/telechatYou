import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Archive, ArchiveRestore, MessageCirclePlus, MessagesSquare, Search, Volume2, VolumeX, Trash2, X } from "lucide-react";
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
  const [selectedChatIds, setSelectedChatIds] = useState<number[]>([]);
  const [botArchived, setBotArchived] = useState(() => {
    try {
      return typeof window !== "undefined" && window.localStorage.getItem("tcy-telechatyou-bot-archived") === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem("tcy-telechatyou-bot-archived", String(botArchived));
    } catch {
      // Archive state remains session-local when storage is unavailable.
    }
  }, [botArchived]);
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

  const items = list.data ?? [];
  const active = items.filter((i) => !i.membership.archived);
  const archived = items.filter((i) => i.membership.archived);
  const shown = showArchived ? archived : active;
  const showBotRow = showArchived ? botArchived : !botArchived;
  const hasArchived = archived.length > 0 || botArchived;
  const archivedUnread = archived.reduce((s, i) => s + i.unread, 0);

  const selectedItems = shown.filter((item) => selectedChatIds.includes(item.chat.id));
  const allSelectedMuted = selectedItems.length > 0 && selectedItems.every((item) => item.membership.muted);

  const toggleSelectedChat = (chatId: number) => {
    setSelectedChatIds((current) =>
      current.includes(chatId) ? current.filter((id) => id !== chatId) : [...current, chatId],
    );
  };

  const toggleSelectedSound = () => {
    if (!selectedItems.length) return;
    const muted = !allSelectedMuted;
    selectedItems.forEach((item) => flags.mutate({ chatId: item.chat.id, muted }));
    setSelectedChatIds([]);
  };

  const toggleSelectedArchive = () => {
    if (!selectedItems.length) return;
    const archived = !showArchived;
    selectedItems.forEach((item) => flags.mutate({ chatId: item.chat.id, archived }));
    setSelectedChatIds([]);
  };

  const deleteSelectedChats = () => {
    if (!selectedItems.length) return;
    const count = selectedItems.length;
    const suffix = count === 1 ? "чат" : count < 5 ? "чата" : "чатов";
    if (!window.confirm(`Удалить ${count} ${suffix}? `)) return;
    selectedItems.forEach((item) => remove.mutate({ chatId: item.chat.id, leave: false }));
    setSelectedChatIds([]);
  };

  return (
    <div className="relative h-full flex flex-col">
      {/* header / bulk selection toolbar */}
      <header className="relative z-10 px-5 pt-5 safe-top pb-3">
        {selectedChatIds.length > 0 ? (
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSelectedChatIds([])}
                className="flex shrink-0 items-center gap-1.5 py-2 text-[14px] font-extrabold"
                style={{ color: "#f05262" }}
              >
                <X size={19} strokeWidth={2.7} /> Закрыть
              </button>
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-[14px] font-black"
                  style={{ background: "var(--tcy-selected-accent)", color: "var(--tcy-selected-on-accent)" }}
                >
                  {selectedChatIds.length}
                </span>
                <span className="truncate text-[14px] font-extrabold tcy-text">выбрано</span>
              </div>
            </div>
            <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar pb-1">
              <button
                type="button"
                onClick={toggleSelectedSound}
                className="flex shrink-0 items-center gap-2 rounded-[15px] border tcy-line tcy-card px-3 py-2.5 text-[12px] font-extrabold tcy-text"
              >
                {allSelectedMuted ? <Volume2 size={16} /> : <VolumeX size={16} />}
                {allSelectedMuted ? "Включить звук" : "Выключить звук"}
              </button>
              <button
                type="button"
                onClick={toggleSelectedArchive}
                className="flex shrink-0 items-center gap-2 rounded-[15px] border tcy-line tcy-card px-3 py-2.5 text-[12px] font-extrabold tcy-text"
              >
                {showArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                {showArchived ? "Из архива" : "В архив"}
              </button>
              <button
                type="button"
                onClick={deleteSelectedChats}
                className="flex shrink-0 items-center gap-2 rounded-[15px] border px-3 py-2.5 text-[12px] font-extrabold"
                style={{ color: "#f05262", borderColor: "color-mix(in srgb, #f05262 35%, var(--tcy-line))", background: "color-mix(in srgb, #f05262 8%, var(--tcy-card))" }}
              >
                <Trash2 size={16} /> Удалить чат
              </button>
            </div>
          </div>
        ) : (
          <>
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
                  className="tcy-search-control tcy-press w-10 h-10 rounded-full tcy-card border tcy-line flex items-center justify-center tcy-dim"
                  aria-label="Поиск"
                >
                  <Search size={18} className="tcy-search-control-icon" />
                </button>
                <button
                  onClick={() => navigate("/new")}
                  className="tcy-press w-10 h-10 rounded-full tcy-gradient-accent tcy-shadow-accent flex items-center justify-center"
                  style={{ color: "var(--tcy-selected-on-accent)" }}
                  aria-label="Новый чат"
                >
                  <MessageCirclePlus size={19} />
                </button>
              </div>
            </div>
            <button
              onClick={() => navigate("/search")}
              className="tcy-search-control mt-4 w-full h-11 rounded-[18px] tcy-card border tcy-line flex items-center gap-3 px-4 text-left tcy-press"
            >
              <Search size={16} className="tcy-search-control-icon" />
              <span className="text-[13.5px] tcy-faint font-medium">Поиск чатов, людей, сообщений…</span>
            </button>
          </>
        )}
      </header>

      {/* archived entry */}
      {!selectedChatIds.length && !showArchived && hasArchived && (
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
      {!selectedChatIds.length && showArchived && (
        <button
          onClick={() => setShowArchived(false)}
          className="mx-4 mb-1 flex items-center gap-3 px-4 py-2.5 tcy-press"
        >
          <span className="text-[13px] font-bold tcy-accent">← К чатам</span>
        </button>
      )}

      {/* Built-in bot can be archived and restored like other chats. */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-28 relative z-10">
        {showBotRow && (
          <div className="tcy-chat-list-item flex items-center gap-2 px-3 py-2.5">
            <button
              type="button"
              onClick={() => navigate("/chat/telechatyou")}
              className="flex min-w-0 flex-1 items-center gap-3.5 py-0.5 text-left"
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
                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md tcy-gradient-accent" style={{ color: "var(--tcy-selected-on-accent)" }}>BOT</span>
                </div>
                <div className="text-[13.5px] tcy-dim truncate mt-0.5">
                  {botArchived ? "В архиве" : "Официальный бот · напишите start"}
                </div>
              </div>
            </button>
            <button
              type="button"
              aria-label={botArchived ? "Вернуть бота из архива" : "Архивировать бота"}
              title={botArchived ? "Вернуть из архива" : "В архив"}
              onClick={() => setBotArchived((value) => !value)}
              className="tcy-press flex h-9 w-9 shrink-0 items-center justify-center rounded-full tcy-card tcy-dim"
            >
              {botArchived ? <ArchiveRestore size={17} /> : <Archive size={17} />}
            </button>
          </div>
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
        ) : shown.length === 0 && !showBotRow ? (
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
                  selected={selectedChatIds.includes(item.chat.id)}
                  selecting={selectedChatIds.length > 0}
                  onToggleSelect={() => toggleSelectedChat(item.chat.id)}
                  onLongPress={() => setSelectedChatIds((current) =>
                    current.includes(item.chat.id) ? current : [...current, item.chat.id],
                  )}
                  onClick={() => navigate(`/chat/${item.chat.id}`)}
                  onAvatarClick={() => {
                    const direct = item.chat.type === "direct";
                    setAvatarPreview({
                      key: (direct ? item.peer?.avatarKey : item.chat.avatarKey) ?? null,
                      name: direct ? item.peer?.displayName ?? "Пользователь" : item.chat.title ?? "Группа",
                      username: direct && item.peer?.username ? `@${item.peer.username}` : null,
                    });
                  }}
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
