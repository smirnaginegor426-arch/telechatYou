import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Archive, ArchiveRestore, Plus, MessagesSquare, Search, Volume2, VolumeX, Trash2, X, Folder } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { ChatItem } from "@/components/ChatItem";
import { Logo, Wordmark } from "@/components/Logo";
import { EmptyState } from "@/components/EmptyState";
import { TcButton } from "@/components/TcButton";
import { Lightbox } from "@/components/Lightbox";
import { ConnectionLoader } from "@/components/ConnectionLoader";

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

export default function Chats({ desktopPanel = false }: { desktopPanel?: boolean } = {}) {
  const navigate = useNavigate();
  const [avatarPreview, setAvatarPreview] = useState<{ key: string | null; name: string; username?: string | null } | null>(null);
  const utils = trpc.useUtils();
  const [showArchived, setShowArchived] = useState(false);
  const [archiveGestureVisible, setArchiveGestureVisible] = useState(false);
  const archiveTouchStart = useRef<number | null>(null);
  const contactNamesQuery = trpc.accountData.contactNames.get.useQuery();
  const contactNames = contactNamesQuery.data?.names ?? {};
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
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  const list = trpc.chats.list.useQuery(undefined, {
    refetchInterval: 4000,
    refetchIntervalInBackground: false,
    // Keep trying until the first successful response so startup reflects
    // the actual connection state instead of falling into an empty/error list.
    retry: true,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void list.refetch();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [list.refetch]);
  const foldersQuery = trpc.accountData.folders.list.useQuery(undefined, { retry: false });
  const ensureFavorites = trpc.chats.ensureFavorites.useMutation({
    onSuccess: () => utils.chats.list.invalidate(),
  });
  useEffect(() => {
    ensureFavorites.mutate();
    // Create or restore the personal Saved Messages chat once when opening the chat list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const invalidate = () => utils.chats.list.invalidate();
  const flags = trpc.chats.setFlags.useMutation({ onSuccess: invalidate });
  const remove = trpc.chats.remove.useMutation({ onSuccess: invalidate });

  const items = list.data ?? [];
  const isFavoritesChat = (item: (typeof items)[number]) => {
    if (item.chat.type !== "direct" || !item.chat.directKey) return false;
    const participants = item.chat.directKey.split(":");
    return participants.length === 2 && participants[0] === participants[1];
  };
  const active = items.filter((i) => !i.membership.archived).sort((a, b) =>
    Number(isFavoritesChat(b)) - Number(isFavoritesChat(a)),
  );
  const archived = items.filter((i) => i.membership.archived).sort((a, b) =>
    Number(isFavoritesChat(b)) - Number(isFavoritesChat(a)),
  );
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

  // Keep the chat area in its loading state until the first successful
  // response. The app shell, header, and bottom navigation remain visible.
  const showConnectionSplash = !list.data && (
    !isOnline || list.isLoading || list.isFetching || list.isError
  );

  return (
    <div className={desktopPanel ? "relative h-full flex flex-col tcy-desktop-chat-list" : "relative h-full flex flex-col"}>
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
                onClick={() => navigate("/folders/new", { state: { chatIds: selectedChatIds } })}
                className="flex shrink-0 items-center gap-2 rounded-[15px] border tcy-line tcy-card px-3 py-2.5 text-[12px] font-extrabold tcy-text"
              >
                <Folder size={16} /> Папка
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
                <Wordmark />
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
                  onClick={() => navigate("/create")}
                  className="tcy-press w-10 h-10 rounded-full tcy-gradient-accent tcy-shadow-accent flex items-center justify-center"
                  style={{ color: "var(--tcy-selected-on-accent)" }}
                  aria-label="Создать канал или группу"
                  title="Создать канал или группу"
                >
                  <Plus size={21} strokeWidth={2.5} />
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

      {!selectedChatIds.length && showArchived && (
        <button
          onClick={() => setShowArchived(false)}
          className="mx-4 mb-1 flex items-center gap-3 px-4 py-2.5 tcy-press"
        >
          <span className="text-[13px] font-bold tcy-accent">← К чатам</span>
        </button>
      )}

      {/* Built-in bot can be archived and restored like other chats. */}
      <div
        className="tcy-chat-list-scroll flex-1 overflow-y-auto no-scrollbar pb-28 relative z-10"
        onTouchStart={(event) => {
          archiveTouchStart.current = event.currentTarget.scrollTop <= 2
            ? event.touches[0]?.clientY ?? null
            : null;
        }}
        onTouchMove={(event) => {
          const start = archiveTouchStart.current;
          if (start === null || !hasArchived || showArchived) return;
          const current = event.touches[0]?.clientY;
          if (current !== undefined && current - start >= 58) {
            setArchiveGestureVisible(true);
            archiveTouchStart.current = null;
          }
        }}
        onTouchEnd={() => { archiveTouchStart.current = null; }}
        onScroll={(event) => {
          if (event.currentTarget.scrollTop > 12) {
            setArchiveGestureVisible(false);
            archiveTouchStart.current = null;
          }
        }}
      >
        {!showArchived && archiveGestureVisible && hasArchived && !selectedChatIds.length && (
          <button
            type="button"
            onClick={() => {
              setShowArchived(true);
              setArchiveGestureVisible(false);
            }}
            className="mx-3 mb-2 mt-1 flex w-[calc(100%-1.5rem)] items-center gap-3 rounded-[18px] border tcy-line tcy-card px-4 py-3 text-left tcy-press"
          >
            <Archive size={17} className="tcy-dim" />
            <span className="flex-1 text-[13.5px] font-semibold tcy-dim">Архив</span>
            {archivedUnread > 0 && <span className="text-[11.5px] font-bold tcy-accent">{archivedUnread} новых</span>}
          </button>
        )}
        {showConnectionSplash ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <ConnectionLoader />
          </div>
        ) : (
          <>
        {!selectedChatIds.length && (foldersQuery.data?.length ?? 0) > 0 && (
          <section className="px-3 pb-2">
            <div className="mb-2 flex items-center justify-between px-2">
              <span className="text-[12px] font-extrabold tcy-dim">Папки</span>
              <button type="button" onClick={() => navigate("/folders/new")} className="text-[11.5px] font-extrabold" style={{ color: "var(--tcy-selected-accent)" }}>Новая</button>
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {foldersQuery.data?.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => navigate(`/folders/${folder.id}`)}
                  className="flex min-w-[118px] max-w-[170px] items-center gap-2.5 rounded-[18px] border tcy-line tcy-card px-3 py-2.5 text-left"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: "color-mix(in srgb, var(--tcy-selected-accent) 12%, var(--tcy-card))", color: "var(--tcy-selected-accent)" }}><Folder size={17} /></span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-extrabold tcy-text">{folder.name}</span>
                    <span className="block text-[10px] tcy-faint">{folder.chatIds.length} чатов</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
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
                  contactNames={contactNames}
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
          </>
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
