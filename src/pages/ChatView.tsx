import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  BarChart3,
  Check,
  Copy,
  Forward,
  Info,
  Pencil,
  Pin,
  Bookmark,
  Star,
  Sticker,
  Reply,
  SmilePlus,
  Trash2,
  X,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Avatar } from "@/components/Avatar";
import { Composer } from "@/components/Composer";
import { BottomSheet } from "@/components/BottomSheet";
import { MessageBubble, ReplyPreviewBar } from "@/components/MessageBubble";
import { Lightbox } from "@/components/Lightbox";
import { computePeaks } from "@/components/VoiceMessage";
import { useFileUrl } from "@/hooks/useFileUrl";
import { EmptyState } from "@/components/EmptyState";
import { QUICK_REACTIONS } from "@/lib/emoji";
import { AppleEmoji } from "@/components/AppleEmoji";
import { fileToBase64, formatDayLabel, formatLastSeen, isOnline, sameDay } from "@/lib/format";
import type { ChatListItem, MessageItem } from "@/types/api";
import { addStickerToPack, saveFavoriteSticker, type StickerAsset } from "@/lib/stickers";
import { cn } from "@/lib/utils";
import {
  CHAT_WALLPAPER_CHANGE_EVENT,
  DEFAULT_CHAT_WALLPAPER,
  chatWallpaperImageKey,
  chatWallpaperKey,
} from "@/lib/chat-wallpapers";
type LocalPinnedSnapshot = {
  id: number;
  kind: string;
  body?: string | null;
  attachmentName?: string | null;
  senderName: string;
};

function messagePreview(message: { kind: string; body?: string | null; attachmentName?: string | null }) {
  if (message.kind === "image") return message.attachmentName?.startsWith("tcy-sticker:") ? "Стикер" : "Фото";
  if (message.kind === "voice") return "Голосовое сообщение";
  if (message.kind === "file") return message.attachmentName ?? "Файл";
  return message.body || "Сообщение";
}

function stickerDetails(attachmentName?: string | null) {
  const match = /^tcy-sticker:([^:]*):([^:]*)$/.exec(attachmentName ?? "");
  if (!match) return { packName: "Сохранённые стикеры", stickerName: "Стикер" };
  try {
    return { packName: decodeURIComponent(match[1]) || "Сохранённые стикеры", stickerName: decodeURIComponent(match[2]) || "Стикер" };
  } catch {
    return { packName: "Сохранённые стикеры", stickerName: "Стикер" };
  }
}

export default function ChatView() {
  const { id } = useParams<{ id: string }>();
  const chatId = Number(id);
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const localPinnedKey = `tcy-local-pinned-message-${chatId}`;

  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [localPinned, setLocalPinned] = useState<LocalPinnedSnapshot | null>(() => {
    try {
      const saved = localStorage.getItem(localPinnedKey);
      return saved ? JSON.parse(saved) as LocalPinnedSnapshot : null;
    } catch {
      return null;
    }
  });
  const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(null);
  const [pinTarget, setPinTarget] = useState<MessageItem | null>(null);
  const [stickerActionMsg, setStickerActionMsg] = useState<MessageItem | null>(null);
  const stickerActionImageUrl = useFileUrl(stickerActionMsg?.attachmentKey ?? null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [replyTo, setReplyTo] = useState<MessageItem | null>(null);
  const [editing, setEditing] = useState<MessageItem | null>(null);
  const [actionMsg, setActionMsg] = useState<MessageItem | null>(null);
  const [forwardMsg, setForwardMsg] = useState<MessageItem | null>(null);
  const [lightbox, setLightbox] = useState<{ key: string; name?: string | null; size?: number | null } | null>(null);
  const [wallpaper, setWallpaper] = useState<string>(DEFAULT_CHAT_WALLPAPER);
  const [wallpaperImage, setWallpaperImage] = useState<string | null>(null);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollMultiple, setPollMultiple] = useState(false);
  const [pollError, setPollError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const myIdRef = useRef<number>(0);

  useEffect(() => {
    const loadSavedWallpaper = () => {
      try {
        setWallpaper(localStorage.getItem(chatWallpaperKey(chatId)) || DEFAULT_CHAT_WALLPAPER);
        setWallpaperImage(localStorage.getItem(chatWallpaperImageKey(chatId)));
      } catch {
        setWallpaper(DEFAULT_CHAT_WALLPAPER);
        setWallpaperImage(null);
      }
    };

    const onWallpaperChange = (event: Event) => {
      const detail = (event as CustomEvent<{ chatId: number; wallpaper: string; image: string | null }>).detail;
      if (detail?.chatId !== chatId) return;
      setWallpaper(detail.wallpaper || DEFAULT_CHAT_WALLPAPER);
      setWallpaperImage(detail.wallpaper === "custom" ? detail.image : null);
    };

    loadSavedWallpaper();
    window.addEventListener(CHAT_WALLPAPER_CHANGE_EVENT, onWallpaperChange);
    return () => window.removeEventListener(CHAT_WALLPAPER_CHANGE_EVENT, onWallpaperChange);
  }, [chatId]);

  const me = trpc.profile.me.useQuery(undefined, { staleTime: 60_000 });
  const myId = me.data?.profile?.userId ?? 0;
  myIdRef.current = myId;

  const info = trpc.chats.info.useQuery({ chatId }, { refetchInterval: 8000 });
  const sharedPinned = trpc.messages.pinned.useQuery({ chatId }, {
    refetchInterval: 6000,
    refetchIntervalInBackground: false,
  });
  const initial = trpc.messages.list.useQuery({ chatId }, { staleTime: 0 });

  const maxId = messages.length ? messages[messages.length - 1].id : 0;
  const live = trpc.messages.list.useQuery(
    { chatId, afterId: maxId },
    {
      enabled: maxId > 0 && !initial.isLoading,
      refetchInterval: 2500,
      refetchIntervalInBackground: false,
    },
  );

  // sync first page
  useEffect(() => {
    if (initial.data) {
      setMessages(initial.data.items);
      setHasMore(initial.data.hasMore);
    }
  }, [initial.data]);

  // merge live messages
  useEffect(() => {
    if (live.data?.items.length) {
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        const fresh = live.data!.items.filter((m) => !ids.has(m.id));
        return fresh.length ? [...prev, ...fresh] : prev;
      });
    }
  }, [live.data]);

  // mark read
  const markRead = trpc.chats.markRead.useMutation({
    onSuccess: () => utils.chats.list.invalidate(),
  });
  useEffect(() => {
    if (maxId > 0) markRead.mutate({ chatId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxId, chatId]);

  // scroll to bottom on new
  useEffect(() => {
    if (stickToBottomRef.current) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      });
    }
  }, [messages.length]);

  const loadOlder = useCallback(async () => {
    if (!hasMore || loadingOlder || !messages.length) return;
    setLoadingOlder(true);
    const beforeHeight = scrollRef.current?.scrollHeight ?? 0;
    try {
      const res = await utils.messages.list.fetch({ chatId, beforeId: messages[0].id });
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        return [...res.items.filter((m) => !ids.has(m.id)), ...prev];
      });
      setHasMore(res.hasMore);
      requestAnimationFrame(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight - beforeHeight;
      });
    } finally {
      setLoadingOlder(false);
    }
  }, [hasMore, loadingOlder, messages, chatId, utils]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (el.scrollTop < 80) void loadOlder();
  };

  // mutations
  const invalidateLists = () => {
    utils.chats.list.invalidate();
  };
  const send = trpc.messages.send.useMutation({ onSuccess: invalidateLists });
  const pinShared = trpc.messages.pin.useMutation({
    onSuccess: () => utils.messages.pinned.invalidate({ chatId }),
  });
  const unpinShared = trpc.messages.unpin.useMutation({
    onSuccess: () => utils.messages.pinned.invalidate({ chatId }),
  });
  const edit = trpc.messages.edit.useMutation();
  const remove = trpc.messages.remove.useMutation({ onSuccess: invalidateLists });
  const forward = trpc.messages.forward.useMutation({
    onSuccess: () => {
      setForwardMsg(null);
      invalidateLists();
    },
  });
  const react = trpc.messages.toggleReaction.useMutation();
  const upload = trpc.storage.upload.useMutation();
  const createPoll = trpc.messages.createPoll.useMutation({
    onSuccess: async () => {
      await utils.messages.list.invalidate({ chatId });
      await utils.chats.list.invalidate();
      setPollOpen(false);
      setPollQuestion("");
      setPollOptions(["", ""]);
      setPollMultiple(false);
      setPollError("");
    },
    onError: (error) => setPollError(error.message),
  });

  const applyLocal = (id: number, patch: Partial<MessageItem>) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const sendText = (text: string) => {
    if (editing) {
      applyLocal(editing.id, { body: text, editedAt: new Date() });
      edit.mutate({ messageId: editing.id, body: text });
      setEditing(null);
      return;
    }
    stickToBottomRef.current = true;
    send.mutate({ chatId, kind: "text", body: text, replyToId: replyTo?.id });
    setReplyTo(null);
  };

  const sendAttachment = async (file: File | Blob, kind: "image" | "file" | "voice", caption?: string) => {
    stickToBottomRef.current = true;
    try {
      const name = file instanceof File ? file.name : `voice-${Date.now()}.webm`;
      const contentType = file.type || (kind === "voice" ? "audio/webm" : undefined);
      const [base64, voiceMeta] = await Promise.all([
        fileToBase64(file),
        kind === "voice" ? computePeaks(file) : Promise.resolve(null),
      ]);
      const res = await upload.mutateAsync({
        name,
        contentBase64: base64,
        contentType,
        folder: kind === "voice" ? "voices" : "uploads",
      });
      send.mutate({
        chatId,
        kind,
        body: caption?.trim() || undefined,
        attachmentKey: res.key,
        attachmentName: name,
        attachmentSize: res.size,
        attachmentMime: contentType,
        voiceMeta: voiceMeta ? JSON.stringify(voiceMeta) : undefined,
        replyToId: replyTo?.id,
      });
      setReplyTo(null);
    } catch (e) {
      alert("Не удалось отправить файл: " + (e as Error).message);
    }
  };

  const sendStickerAsset = async (sticker: StickerAsset, packName: string) => {
    try {
      let attachmentKey = sticker.attachmentKey;
      let attachmentSize = 0;
      let attachmentMime = sticker.contentType ?? "image/webp";
      if (!attachmentKey && sticker.dataUrl) {
        const response = await fetch(sticker.dataUrl);
        const blob = await response.blob();
        const base64 = await fileToBase64(blob);
        const uploaded = await upload.mutateAsync({
          name: `sticker-${Date.now()}.webp`,
          contentBase64: base64,
          contentType: blob.type || "image/webp",
          folder: "uploads",
        });
        attachmentKey = uploaded.key;
        attachmentSize = uploaded.size;
        attachmentMime = uploaded.contentType ?? blob.type ?? "image/webp";
      }
      if (!attachmentKey) {
        alert("Не удалось открыть стикер. Попробуй выбрать его ещё раз.");
        return;
      }
      const sent = await send.mutateAsync({
        chatId,
        kind: "image",
        attachmentKey,
        attachmentName: `tcy-sticker:${encodeURIComponent(packName.slice(0, 20))}:${encodeURIComponent(sticker.name.slice(0, 12))}`,
        attachmentSize: attachmentSize || undefined,
        attachmentMime,
      });
      setMessages((current) => current.some((message) => message.id === sent.id) ? current : [...current, sent].sort((a, b) => a.id - b.id));
      stickToBottomRef.current = true;
      setStickerActionMsg(null);
      await utils.chats.list.invalidate();
    } catch (error) {
      alert("Не удалось отправить стикер: " + (error instanceof Error ? error.message : "неизвестная ошибка"));
    }
  };

  const chat = info.data?.chat;
  const peer = info.data?.peer;
  const channel = info.data?.channel;
  const isChannel = !!channel;
  const canPublish = !channel || info.data?.me.role === "owner" || info.data?.me.role === "admin";
  const isGroup = chat?.type === "group";
  const directParts = chat?.directKey?.split(":") ?? [];
  const isFavoritesChat = chat?.type === "direct" && directParts.length === 2 && directParts[0] === directParts[1];
  const title = isFavoritesChat ? "Избранное" : isGroup ? chat?.title ?? "Группа" : peer?.displayName ?? "…";
  const peerMember = info.data?.members.find((m) => m.userId !== myId);
  const peerLastReadId = !isGroup ? peerMember?.lastReadMessageId ?? 0 : 0;
  const online = !isGroup && isOnline(peer?.lastSeenAt);
  const status = isFavoritesChat
    ? "Личные сохранённые сообщения"
    : channel
      ? channel.isPublic ? `Публичный канал · @${channel.username}` : "Приватный канал"
      : isGroup
        ? `${info.data?.members.length ?? 0} участн.`
        : online
          ? "в сети"
          : peer
            ? formatLastSeen(peer.lastSeenAt)
            : "";
  const visibleMessages = isChannel ? messages.filter((message) => message.kind !== "system") : messages;
  const activePinnedMessage = localPinned ?? sharedPinned.data?.message ?? null;
  const activePinnedId = activePinnedMessage?.id ?? null;

  const jumpToMessage = async (targetId: number) => {
    stickToBottomRef.current = false;
    let beforeId = messages[0]?.id;
    let attempts = 0;
    while (!messages.some((message) => message.id === targetId) && beforeId && beforeId > targetId && attempts < 100) {
      const result = await utils.messages.list.fetch({ chatId, beforeId });
      if (!result.items.length) break;
      setMessages((current) => {
        const ids = new Set(current.map((message) => message.id));
        return [...result.items.filter((message) => !ids.has(message.id)), ...current].sort((a, b) => a.id - b.id);
      });
      beforeId = result.items[0].id;
      attempts += 1;
      if (result.items.some((message) => message.id === targetId) || !result.hasMore) break;
    }
    setHighlightedMessageId(targetId);
  };

  useEffect(() => {
    if (highlightedMessageId === null || !messages.some((message) => message.id === highlightedMessageId)) return;
    const frame = window.requestAnimationFrame(() => {
      document.querySelector(`[data-message-id="${highlightedMessageId}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    const timer = window.setTimeout(() => setHighlightedMessageId(null), 1800);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [messages, highlightedMessageId]);

  const submitPoll = () => {
    setPollError("");
    const options = pollOptions.map((option) => option.trim()).filter(Boolean);
    if (pollQuestion.trim().length < 2) {
      setPollError("Введите вопрос опроса.");
      return;
    }
    if (options.length < 2) {
      setPollError("Добавьте как минимум два варианта.");
      return;
    }
    if (new Set(options.map((option) => option.toLowerCase())).size !== options.length) {
      setPollError("Варианты не должны повторяться.");
      return;
    }
    createPoll.mutate({
      chatId,
      question: pollQuestion.trim(),
      options,
      allowMultiple: pollMultiple,
    });
  };

  const chatItems: ChatListItem[] = useMemo(() => {
    const all = utils.chats.list.getData() ?? [];
    return all.filter((c) => c.chat.id !== chatId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forwardMsg, chatId]);

  const onReaction = (m: MessageItem, emoji: string) => {
    const mine = m.reactions.filter((r) => r.userId === myIdRef.current);
    const already = mine.some((r) => r.emoji === emoji);
    if (!already && mine.length >= 3) {
      alert("Можно поставить не больше 3 реакций на одно сообщение.");
      return;
    }
    applyLocal(
      m.id,
      already
        ? { reactions: m.reactions.filter((r) => !(r.userId === myIdRef.current && r.emoji === emoji)) }
        : {
            reactions: [...m.reactions, {
              emoji,
              userId: myIdRef.current,
              displayName: me.data?.profile?.displayName ?? "Вы",
              avatarKey: me.data?.profile?.avatarKey ?? null,
            }],
          },
    );
    react.mutate({ messageId: m.id, emoji });
  };

  return (
    <div className="relative h-full flex flex-col">
      {/* header */}
      <header className="relative z-20 tcy-header-blur border-b tcy-line">
        <div className="flex items-center gap-2 px-2.5 pt-3 pb-2.5 safe-top">
          <button
            onClick={() => navigate("/")}
            className="tcy-press w-10 h-10 rounded-full flex items-center justify-center tcy-dim"
            aria-label="Назад"
          >
            <ArrowLeft size={20} />
          </button>
          <button
            onClick={() => navigate(`/chat/${chatId}/info`)}
            className="flex items-center gap-3 flex-1 min-w-0 text-left tcy-press rounded-[18px] py-0.5"
          >
            <Avatar
              name={title}
              avatarKey={isGroup ? chat?.avatarKey : peer?.avatarKey}
              size={40}
              lastSeenAt={peer?.lastSeenAt}
              showOnline={!isGroup}
            />
            <div className="min-w-0">
              <div className="font-bold text-[15.5px] tcy-text truncate">{title}</div>
              <div
                className="text-[12px] font-semibold truncate transition-colors"
                style={{ color: online ? "var(--tcy-accent)" : "var(--tcy-faint)" }}
              >
                {status}
              </div>
            </div>
          </button>
          <button
            onClick={() => navigate(`/chat/${chatId}/info`)}
            className="tcy-press w-10 h-10 rounded-full flex items-center justify-center tcy-dim"
            aria-label="Информация"
          >
            <Info size={19} />
          </button>
        </div>
      </header>

      {activePinnedMessage && activePinnedId !== null && (
        <div className="relative z-10 mx-3 mb-1 flex items-center gap-2 rounded-[16px] border tcy-line tcy-card px-3 py-2">
          <button type="button" onClick={() => void jumpToMessage(activePinnedId)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px]" style={{ background: "color-mix(in srgb, var(--tcy-selected-accent) 15%, var(--tcy-card))", color: "var(--tcy-selected-accent)" }}>
              <Pin size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-extrabold" style={{ color: "var(--tcy-selected-accent)" }}>Закреплённое сообщение</span>
              <span className="block truncate text-[12px] tcy-dim">{messagePreview(activePinnedMessage)}</span>
            </span>
          </button>
          <button
            type="button"
            aria-label="Открепить сообщение"
            title="Открепить сообщение"
            onClick={() => {
              if (localPinned) {
                setLocalPinned(null);
                try { localStorage.removeItem(localPinnedKey); } catch { /* local pin is optional */ }
              } else {
                unpinShared.mutate({ chatId });
              }
            }}
            className="tcy-press flex h-8 w-8 shrink-0 items-center justify-center rounded-full tcy-faint"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* messages */}
      <div className="relative flex-1 min-h-0">
        <div
          aria-hidden="true"
          className={cn(
            "tcy-wallpaper",
            wallpaper !== "custom" && `tcy-wallpaper-bg--${wallpaper}`,
          )}
          style={
            wallpaper === "custom" && wallpaperImage
              ? {
                  backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.14), rgba(0, 0, 0, 0.36)), url("${wallpaperImage}")`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                }
              : undefined
          }
        />
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="absolute inset-0 z-[1] overflow-y-auto no-scrollbar py-3"
        >
          {loadingOlder && (
            <div className="flex justify-center py-2">
              <span className="h-5 w-5 rounded-full border-2 tcy-line border-t-[color:var(--tcy-accent)] animate-spin" style={{ borderTopColor: "var(--tcy-accent)" }} />
            </div>
          )}
          {hasMore && !loadingOlder && (
            <div className="text-center text-[11.5px] tcy-faint pb-1">Потяните вниз для истории</div>
          )}
          {initial.isLoading ? (
            <div className="space-y-3 px-4 pt-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className={cn("flex", i % 2 ? "justify-end" : "justify-start")}>
                  <div
                    className="tcy-skeleton rounded-[22px]"
                    style={{ width: `${45 + (i % 3) * 12}%`, height: 52 + (i % 2) * 18 }}
                  />
                </div>
              ))}
            </div>
          ) : visibleMessages.length === 0 ? (
            <EmptyState
              icon={<Reply size={32} />}
              title={isChannel ? "Пока нет публикаций" : "Начните разговор"}
              hint={isChannel ? "Новые публикации появятся здесь." : "Напишите первое сообщение — оно появится здесь."}
            />
          ) : (
            visibleMessages.map((m, i) => {
              const prev = visibleMessages[i - 1];
              const dayBreak = !prev || !sameDay(prev.createdAt, m.createdAt);
              const own = m.senderId === myId;
              const showSender =
                isGroup && (isChannel || (!own && (!prev || prev.senderId !== m.senderId || sameDay(prev.createdAt, m.createdAt) === false)));
              return (
                <div key={m.id}>
                  {dayBreak && (
                    <div className="flex justify-center my-3">
                      <span className="text-[11.5px] font-bold tcy-dim tcy-header-blur border tcy-line px-3.5 py-1.5 rounded-full">
                        {formatDayLabel(m.createdAt)}
                      </span>
                    </div>
                  )}
                  <MessageBubble
                    m={m}
                    own={own}
                    myId={myId}
                    isGroup={!!isGroup}
                    isChannel={isChannel}
                    showSender={!!showSender}
                    peerLastReadId={peerLastReadId}
                    onLongPress={setActionMsg}
                    onImageOpen={(key) =>
                      setLightbox({ key, name: m.attachmentName, size: m.attachmentSize })
                    }
                    onStickerOpen={setStickerActionMsg}
                    highlighted={highlightedMessageId === m.id}
                    onReaction={onReaction}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* reply / edit bars + composer */}
      <AnimatePresence>
        {replyTo && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
            <ReplyPreviewBar m={replyTo} onClose={() => setReplyTo(null)} />
          </motion.div>
        )}
        {editing && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
            <div className="flex items-center gap-2.5 px-4 py-2 tcy-solid-2 border-t tcy-line">
              <Pencil size={16} style={{ color: "var(--tcy-accent)" }} />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-bold tcy-accent">Редактирование</div>
                <div className="text-[12.5px] tcy-dim truncate">{editing.body}</div>
              </div>
              <button onClick={() => setEditing(null)} className="tcy-press tcy-faint text-lg px-2">✕</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {isChannel && canPublish && (
        <div className="px-3 pb-1">
          <button
            type="button"
            onClick={() => {
              setPollError("");
              setPollOpen(true);
            }}
            className="tcy-press w-full h-9 rounded-[13px] tcy-card border tcy-line flex items-center justify-center gap-2 text-[12px] font-bold tcy-accent"
          >
            <BarChart3 size={15} /> Создать опрос
          </button>
        </div>
      )}

      {canPublish ? (
        <Composer
          onSendText={sendText}
          onSendVoice={(blob) => void sendAttachment(blob, "voice")}
          onAttachImage={(f, caption) => void sendAttachment(f, "image", caption)}
          onAttachFile={(f, caption) => void sendAttachment(f, "file", caption)}
          sending={send.isPending || upload.isPending || createPoll.isPending}
          onSendSticker={(sticker, packName) => void sendStickerAsset(sticker, packName)}
          enterToSend
        />
      ) : (
        <div className="px-4 pb-4 pt-2 safe-bottom">
          <div className="rounded-[18px] border tcy-line tcy-card px-4 py-3 text-center text-[12.5px] tcy-dim">
            Нет доступа к публикации
          </div>
        </div>
      )}

      {pollOpen && isChannel && canPublish && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 px-3 pb-3">
          <button
            type="button"
            className="absolute inset-0 w-full h-full cursor-default"
            aria-label="Закрыть создание опроса"
            onClick={() => setPollOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-[26px] tcy-solid border tcy-line p-4 space-y-3 tcy-shadow-soft">
            <div className="flex items-center gap-2">
              <BarChart3 size={19} className="tcy-accent" />
              <h2 className="flex-1 text-[17px] font-extrabold tcy-text">Новый опрос</h2>
              <button type="button" onClick={() => setPollOpen(false)} className="tcy-press w-9 h-9 rounded-full tcy-card flex items-center justify-center tcy-dim" aria-label="Закрыть">
                <X size={17} />
              </button>
            </div>
            <input
              value={pollQuestion}
              onChange={(event) => setPollQuestion(event.target.value)}
              maxLength={500}
              placeholder="Задайте вопрос"
              className="w-full h-11 rounded-[15px] tcy-card border tcy-line px-3.5 text-[13.5px] tcy-text outline-none focus:border-[color:var(--tcy-accent)]"
            />
            <div className="space-y-2 max-h-[36vh] overflow-y-auto no-scrollbar">
              {pollOptions.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    value={option}
                    onChange={(event) => setPollOptions((current) => current.map((value, i) => i === index ? event.target.value : value))}
                    maxLength={255}
                    placeholder={`Вариант ${index + 1}`}
                    className="flex-1 min-w-0 h-10 rounded-[14px] tcy-card border tcy-line px-3 text-[13px] tcy-text outline-none focus:border-[color:var(--tcy-accent)]"
                  />
                  {pollOptions.length > 2 && (
                    <button type="button" onClick={() => setPollOptions((current) => current.filter((_, i) => i !== index))} className="tcy-press w-9 h-9 rounded-full tcy-card flex items-center justify-center tcy-faint" aria-label="Удалить вариант">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
              {pollOptions.length < 10 && (
                <button
                  type="button"
                  onClick={() => setPollOptions((current) => current.length < 10 ? [...current, ""] : current)}
                  className="tcy-press text-[12px] font-bold tcy-accent px-1 py-1"
                >
                  + Добавить вариант
                </button>
              )}
            </div>
            <label className="flex items-center gap-2.5 text-[12.5px] tcy-dim">
              <input type="checkbox" checked={pollMultiple} onChange={(event) => setPollMultiple(event.target.checked)} />
              Разрешить несколько ответов
            </label>
            {pollError && <p role="alert" className="text-[12px]" style={{ color: "var(--tcy-danger)" }}>{pollError}</p>}
            <button
              type="button"
              onClick={submitPoll}
              disabled={createPoll.isPending}
              className="tcy-press w-full h-11 rounded-[15px] tcy-gradient-accent text-[13px] font-bold disabled:opacity-50"
              style={{ color: "var(--tcy-on-accent)" }}
            >
              {createPoll.isPending ? "Публикуем…" : "Опубликовать опрос"}
            </button>
          </div>
        </div>
      )}

      {/* message actions sheet */}
      <BottomSheet open={!!actionMsg} onClose={() => setActionMsg(null)}>
        {actionMsg && (
          <div className="px-4">
            <div className="flex gap-2 justify-between px-1 pb-4 overflow-x-auto no-scrollbar">
              {QUICK_REACTIONS.map((e) => (
                <button
                  key={e}
                  onClick={() => {
                    onReaction(actionMsg, e);
                    setActionMsg(null);
                  }}
                  className="tcy-press text-[26px] w-11 h-11 rounded-full tcy-card flex items-center justify-center"
                >
                  <AppleEmoji emoji={e} size={27} />
                </button>
              ))}
            </div>
            <div className="rounded-[22px] tcy-card border tcy-line overflow-hidden divide-y divide-[color:var(--tcy-line)]">
              {(
                [
                  {
                    icon: <Reply size={18} />,
                    label: "Ответить",
                    fn: () => {
                      setReplyTo(actionMsg);
                      setActionMsg(null);
                    },
                  },
                  {
                    icon: <SmilePlus size={18} />,
                    label: "Реакция ❤️",
                    fn: () => {
                      onReaction(actionMsg, "❤️");
                      setActionMsg(null);
                    },
                  },
                  actionMsg.kind === "text"
                    ? {
                        icon: <Copy size={18} />,
                        label: "Копировать",
                        fn: () => {
                          void navigator.clipboard?.writeText(actionMsg.body ?? "");
                          setActionMsg(null);
                        },
                      }
                    : null,
                  {
                    icon: <Pin size={18} />,
                    label: "Закрепить сообщение",
                    fn: () => {
                      setPinTarget(actionMsg);
                      setActionMsg(null);
                    },
                  },
                  {
                    icon: <Forward size={18} />,
                    label: "Переслать",
                    fn: () => {
                      setForwardMsg(actionMsg);
                      setActionMsg(null);
                    },
                  },
                  actionMsg.senderId === myId && actionMsg.kind === "text"
                    ? {
                        icon: <Pencil size={18} />,
                        label: "Изменить",
                        fn: () => {
                          setEditing(actionMsg);
                          setActionMsg(null);
                        },
                      }
                    : null,
                ] as ({ icon: React.ReactNode; label: string; fn: () => void } | null)[]
              )
                .filter((a): a is { icon: React.ReactNode; label: string; fn: () => void } => a !== null)
                .map((a) => (
                  <button
                    key={a.label}
                    onClick={a.fn}
                    className="w-full flex items-center gap-3.5 px-4 py-3.5 text-[14.5px] font-semibold tcy-text active:bg-[color:var(--tcy-card-strong)]"
                  >
                    <span className="tcy-dim">{a.icon}</span> {a.label}
                  </button>
                ))}
              {(actionMsg.senderId === myId ||
                info.data?.me.role === "owner" ||
                info.data?.me.role === "admin") && (
                <button
                  onClick={() => {
                    applyLocal(actionMsg.id, { deletedAt: new Date() });
                    remove.mutate({ messageId: actionMsg.id });
                    setActionMsg(null);
                  }}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 text-[14.5px] font-semibold tcy-danger active:bg-[color:var(--tcy-card-strong)]"
                >
                  <Trash2 size={18} /> Удалить
                </button>
              )}
            </div>
          </div>
        )}
      </BottomSheet>

      {/* pin target scope */}
      <BottomSheet open={!!pinTarget} onClose={() => setPinTarget(null)} title="Закрепить сообщение">
        {pinTarget && (
          <div className="space-y-2 px-4 pb-3">
            <div className="rounded-[16px] border tcy-line tcy-card p-3">
              <p className="text-[11px] font-extrabold" style={{ color: "var(--tcy-selected-accent)" }}>Выбрано сообщение</p>
              <p className="mt-1 truncate text-[13px] tcy-text">{messagePreview(pinTarget)}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                const snapshot: LocalPinnedSnapshot = {
                  id: pinTarget.id,
                  kind: pinTarget.kind,
                  body: pinTarget.body,
                  attachmentName: pinTarget.attachmentName,
                  senderName: pinTarget.sender?.displayName ?? (pinTarget.senderId === myId ? "Вы" : title),
                };
                setLocalPinned(snapshot);
                try { localStorage.setItem(localPinnedKey, JSON.stringify(snapshot)); } catch { /* local pins are optional */ }
                setPinTarget(null);
              }}
              className="tcy-press flex w-full items-center gap-3 rounded-[16px] border tcy-line tcy-card px-4 py-3.5 text-left"
            >
              <Bookmark size={19} className="tcy-dim" />
              <span className="flex-1">
                <span className="block text-[14px] font-extrabold tcy-text">Только у себя</span>
                <span className="block text-[11.5px] tcy-faint">Закрепление видно только на этом устройстве</span>
              </span>
            </button>
            <button
              type="button"
              disabled={pinShared.isPending}
              onClick={() => {
                try { localStorage.removeItem(localPinnedKey); } catch { /* local pin is optional */ }
                setLocalPinned(null);
                pinShared.mutate({ chatId, messageId: pinTarget.id }, { onSuccess: () => setPinTarget(null) });
              }}
              className="tcy-press flex w-full items-center gap-3 rounded-[16px] border tcy-line tcy-card px-4 py-3.5 text-left disabled:opacity-50"
            >
              <Pin size={19} style={{ color: "var(--tcy-selected-accent)" }} />
              <span className="flex-1">
                <span className="block text-[14px] font-extrabold tcy-text">У себя и собеседника</span>
                <span className="block text-[11.5px] tcy-faint">Покажет закрепление всем участникам чата</span>
              </span>
            </button>
          </div>
        )}
      </BottomSheet>

      {/* sticker actions */}
      <BottomSheet open={!!stickerActionMsg} onClose={() => setStickerActionMsg(null)} title="Стикер">
        {stickerActionMsg && (
          <div className="px-4 pb-4">
            <div className="mb-4 flex items-center justify-center rounded-[22px] tcy-card p-5">
              {stickerActionImageUrl ? (
                <img src={stickerActionImageUrl} alt="Стикер" className="max-h-[190px] max-w-[190px] object-contain" />
              ) : (
                <span className="flex h-[150px] w-[150px] items-center justify-center tcy-faint"><Sticker size={35} /></span>
              )}
            </div>
            <div className="overflow-hidden rounded-[20px] border tcy-line tcy-card">
              <button
                type="button"
                onClick={() => {
                  const details = stickerDetails(stickerActionMsg.attachmentName);
                  const sticker: StickerAsset = {
                    id: `received-${stickerActionMsg.id}`,
                    name: details.stickerName,
                    attachmentKey: stickerActionMsg.attachmentKey ?? undefined,
                    contentType: stickerActionMsg.attachmentMime ?? undefined,
                  };
                  addStickerToPack(details.packName, sticker);
                  setStickerActionMsg(null);
                }}
                className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left text-[13.5px] font-extrabold tcy-text"
              >
                <Sticker size={18} className="tcy-dim" /> Сохранить стикер-пак
              </button>
              <button
                type="button"
                onClick={() => {
                  const details = stickerDetails(stickerActionMsg.attachmentName);
                  void sendStickerAsset({
                    id: `received-${stickerActionMsg.id}`,
                    name: details.stickerName,
                    attachmentKey: stickerActionMsg.attachmentKey ?? undefined,
                    contentType: stickerActionMsg.attachmentMime ?? undefined,
                  }, details.packName);
                  setStickerActionMsg(null);
                }}
                className="flex w-full items-center gap-3.5 border-t tcy-line px-4 py-3.5 text-left text-[13.5px] font-extrabold tcy-text"
              >
                <Sticker size={18} className="tcy-dim" /> Отправить только стикер
              </button>
              <button
                type="button"
                onClick={() => {
                  const details = stickerDetails(stickerActionMsg.attachmentName);
                  saveFavoriteSticker({
                    id: `received-${stickerActionMsg.id}`,
                    name: details.stickerName,
                    packName: details.packName,
                    attachmentKey: stickerActionMsg.attachmentKey ?? undefined,
                    contentType: stickerActionMsg.attachmentMime ?? undefined,
                  });
                  setStickerActionMsg(null);
                }}
                className="flex w-full items-center gap-3.5 border-t tcy-line px-4 py-3.5 text-left text-[13.5px] font-extrabold tcy-text"
              >
                <Star size={18} className="tcy-dim" /> Положить стикер в избранное
              </button>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* forward picker */}
      <BottomSheet open={!!forwardMsg} onClose={() => setForwardMsg(null)} title="Переслать в…">
        <div className="px-2">
          {chatItems.length === 0 && (
            <p className="text-center tcy-dim text-[13.5px] py-6">Нет других чатов</p>
          )}
          {chatItems.map((c) => {
            const t = c.chat.type === "direct" ? c.peer?.displayName ?? "?" : c.chat.title ?? "Группа";
            return (
              <button
                key={c.chat.id}
                onClick={() => forward.mutate({ messageIds: [forwardMsg!.id], targetChatId: c.chat.id })}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[18px] active:bg-[color:var(--tcy-card)] tcy-press"
              >
                <Avatar
                  name={t}
                  avatarKey={c.chat.type === "direct" ? c.peer?.avatarKey : c.chat.avatarKey}
                  size={44}
                />
                <span className="text-[14.5px] font-semibold tcy-text truncate">{t}</span>
                <Check size={16} className="ml-auto tcy-faint" />
              </button>
            );
          })}
        </div>
      </BottomSheet>

      <Lightbox
        imageKey={lightbox?.key ?? null}
        name={lightbox?.name}
        size={lightbox?.size}
        onClose={() => setLightbox(null)}
      />
    </div>
  );
}
