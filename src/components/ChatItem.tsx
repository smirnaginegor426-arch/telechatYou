import { useRef } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { motion } from "framer-motion";
import { Archive, Pin, VolumeX, Check, CheckCheck, Image as ImageIcon, FileText, Mic } from "lucide-react";
import { Avatar } from "./Avatar";
import { TesterBadge } from "@/components/TesterBadge";
import { isTesterUsername } from "@/lib/testers";
import { formatChatTime } from "@/lib/format";
import type { RouterOutput } from "@/types/api";

type ChatListItem = RouterOutput["chats"]["list"][number];

function lastMessagePreview(item: ChatListItem): React.ReactNode {
  const m = item.lastMessage;
  if (!m) return "Нет сообщений";
  if (m.kind === "system") return m.body ?? "";
  const prefix =
    item.chat.type === "group" && m.senderId !== undefined && item.lastSender
      ? `${item.lastSender.displayName.split(" ")[0]}: `
      : "";
  if (m.kind === "image")
    return (
      <span className="inline-flex items-center gap-1.5">
        {prefix}
        <ImageIcon size={14} className="shrink-0" /> Фото
      </span>
    );
  if (m.kind === "file")
    return (
      <span className="inline-flex items-center gap-1.5">
        {prefix}
        <FileText size={14} className="shrink-0" /> {m.attachmentName ?? "Файл"}
      </span>
    );
  if (m.kind === "voice")
    return (
      <span className="inline-flex items-center gap-1.5">
        {prefix}
        <Mic size={14} className="shrink-0" /> Голосовое
      </span>
    );
  return prefix + (m.body ?? "");
}

export function ChatItem({
  item,
  contactNames = {},
  onClick,
  onAvatarClick,
  index,
  selected = false,
  selecting = false,
  onToggleSelect,
  onLongPress,
  onArchive,
}: {
  item: ChatListItem;
  contactNames?: Record<string, string>;
  onClick: () => void;
  onAvatarClick?: () => void;
  index: number;
  selected?: boolean;
  selecting?: boolean;
  onToggleSelect?: () => void;
  onLongPress?: () => void;
  onArchive?: () => void;
}) {
  const isDirect = item.chat.type === "direct";
  const directParts = item.chat.directKey?.split(":") ?? [];
  const isFavorites = isDirect && directParts.length === 2 && directParts[0] === directParts[1];
  const peerId = item.peer?.userId;
  const title = isFavorites ? "Избранное" : isDirect ? (peerId ? contactNames[String(peerId)] : undefined) ?? item.peer?.displayName ?? "Пользователь" : item.chat.title ?? "Группа";
  const subtitle = isFavorites ? "Личные сохранённые сообщения" : isDirect ? `@${item.peer?.username ?? ""}` : `${item.membersCount} участн.`;
  const own =
    item.lastMessage && item.peer && item.lastMessage.senderId !== item.peer.userId;
  const pressTimer = useRef<number | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggered = useRef(false);
  const swipeStart = useRef<{ x: number; y: number; base: number } | null>(null);
  const swipeActive = useRef(false);
  const swipeOffsetRef = useRef(0);
  const suppressClick = useRef(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeDragging, setSwipeDragging] = useState(false);
  const ARCHIVE_REVEAL_WIDTH = 100;

  const clearPressTimer = () => {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    longPressTriggered.current = false;
    suppressClick.current = false;
    pressStart.current = { x: event.clientX, y: event.clientY };
    swipeStart.current = !selecting && onArchive
      ? { x: event.clientX, y: event.clientY, base: swipeOffsetRef.current }
      : null;
    swipeActive.current = false;
    clearPressTimer();
    if (selecting) return;

    pressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      onLongPress?.();
      if ("vibrate" in navigator) navigator.vibrate?.(12);
    }, 460);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = swipeStart.current;
    if (start && onArchive && !selecting) {
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      const horizontal = Math.abs(dx) > Math.abs(dy) * 1.15;
      if (
        !swipeActive.current &&
        horizontal &&
        (dx < -12 || (start.base > 0 && dx > 12))
      ) {
        swipeActive.current = true;
        setSwipeDragging(true);
        suppressClick.current = true;
        clearPressTimer();
        pressStart.current = null;
      }
      if (swipeActive.current) {
        const nextOffset = Math.max(0, Math.min(ARCHIVE_REVEAL_WIDTH, start.base - dx));
        swipeOffsetRef.current = nextOffset;
        setSwipeOffset(nextOffset);
        return;
      }
    }

    if (!pressStart.current || pressTimer.current === null) return;
    if (Math.hypot(event.clientX - pressStart.current.x, event.clientY - pressStart.current.y) > 12) {
      clearPressTimer();
      pressStart.current = null;
    }
  };

  const handlePointerEnd = (cancelled = false) => {
    clearPressTimer();
    pressStart.current = null;
    const wasSwipe = swipeActive.current;
    if (wasSwipe) {
      const shouldArchive =
        !cancelled &&
        swipeOffsetRef.current >= ARCHIVE_REVEAL_WIDTH - 1 &&
        !selecting &&
        !!onArchive;
      swipeActive.current = false;
      setSwipeDragging(false);
      swipeStart.current = null;
      swipeOffsetRef.current = 0;
      setSwipeOffset(0);
      suppressClick.current = true;
      // Native click follows pointerup; clear the guard after that click cycle
      // in case the shifted row is no longer the click target.
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
      if (shouldArchive) onArchive?.();
      return;
    }
    swipeStart.current = null;
  };

  const handleRowClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    if (selecting) onToggleSelect?.();
    else onClick();
  };

  const handleAvatarClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    if (selecting) onToggleSelect?.();
    else onAvatarClick?.();
  };

  return (
    <div className="tcy-chat-item-swipe-container relative overflow-hidden" style={{ touchAction: "pan-y" }}>
      {onArchive && !selecting && (
        <div
          aria-hidden="true"
          className="absolute inset-y-0 right-0 z-0 flex w-[100px] items-center justify-center select-none"
          style={{ pointerEvents: "none" }}
        >
          <motion.div
            className="flex flex-col items-center justify-center gap-1.5"
            animate={{
              opacity: Math.min(1, swipeOffset / 26),
              scale: 0.82 + Math.min(1, swipeOffset / ARCHIVE_REVEAL_WIDTH) * 0.18,
            }}
            transition={swipeDragging ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 30 }}
          >
            <span
              className="flex h-[50px] w-[50px] items-center justify-center rounded-[17px] border tcy-line"
              style={{
                color: "var(--tcy-selected-accent)",
                background: "color-mix(in srgb, var(--tcy-selected-accent) 13%, var(--tcy-card))",
              }}
            >
              <Archive size={22} strokeWidth={2.1} />
            </span>
            <span className="text-[11.5px] leading-none font-bold tcy-dim">Архив</span>
          </motion.div>
        </div>
      )}
      <motion.div
        role="button"
        tabIndex={0}
        aria-pressed={selecting ? selected : undefined}
        initial={{ opacity: 0, y: 12, x: 0 }}
        animate={{ opacity: 1, y: 0, x: -swipeOffset }}
        transition={
          swipeDragging
            ? { duration: 0 }
            : {
                opacity: { delay: Math.min(index * 0.035, 0.3), type: "spring", stiffness: 300, damping: 30 },
                y: { delay: Math.min(index * 0.035, 0.3), type: "spring", stiffness: 300, damping: 30 },
                x: { type: "spring", stiffness: 420, damping: 30 },
              }
        }
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={() => handlePointerEnd(false)}
        onPointerCancel={() => handlePointerEnd(true)}
        onContextMenu={(event) => event.preventDefault()}
        onClick={handleRowClick}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleRowClick();
          }
        }}
        className={`tcy-chat-list-item relative z-10 w-full flex items-center gap-3.5 px-4 py-3 text-left transition-colors ${selected ? "tcy-chat-list-item-selected" : ""}`}
        style={{ touchAction: "pan-y" }}
      >
      {selecting && (
        <span
          aria-hidden="true"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2"
          style={{
            borderColor: selected ? "var(--tcy-selected-accent)" : "var(--tcy-faint)",
            background: selected ? "var(--tcy-selected-accent)" : "transparent",
            color: "var(--tcy-selected-on-accent)",
          }}
        >
          {selected && <Check size={15} strokeWidth={3} />}
        </span>
      )}
      {isFavorites ? (
        <span
          className="tcy-favorite-chat-avatar flex h-[54px] w-[54px] items-center justify-center rounded-[30%]"
          aria-label="Избранное"
        >
          <svg width="54" height="54" viewBox="0 0 54 54" fill="none" aria-hidden="true">
            <defs>
              <linearGradient id="tcy-favorite-bookmark-gradient" x1="5" y1="4" x2="49" y2="51" gradientUnits="userSpaceOnUse">
                <stop stopColor="#49B8F0" />
                <stop offset="1" stopColor="#168FE5" />
              </linearGradient>
            </defs>
            <circle cx="27" cy="27" r="27" fill="url(#tcy-favorite-bookmark-gradient)" />
            <path
              d="M17 14.2C17 12 18.8 10.2 21 10.2H33C35.2 10.2 37 12 37 14.2V40.4L27 33.6L17 40.4V14.2Z"
              fill="white"
            />
          </svg>
        </span>
      ) : (
        <button
          type="button"
          aria-label={isDirect ? `Открыть аватар пользователя ${title}` : `Открыть аватар ${title}`}
          onClick={handleAvatarClick}
          className="tcy-press rounded-full shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--tcy-selected-accent)]"
        >
          <Avatar
            name={title}
            avatarKey={isDirect ? item.peer?.avatarKey : item.chat.avatarKey}
            size={54}
            lastSeenAt={isDirect ? item.peer?.lastSeenAt : null}
            showOnline={isDirect}
          />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-bold text-[15.5px] tcy-text truncate flex items-center gap-1.5">
            {title}
            {isDirect && isTesterUsername(item.peer?.username, item.peer?.userId) && <TesterBadge />}
            {item.membership.pinned && (
              <Pin size={12} style={{ color: "var(--tcy-faint)" }} className="shrink-0 rotate-45" />
            )}
          </span>
          {item.lastMessage && (
            <span
              className="text-[11.5px] font-semibold shrink-0"
              style={{
                color: item.unread > 0 && !item.membership.muted ? "var(--tcy-selected-accent)" : "var(--tcy-faint)",
              }}
            >
              {formatChatTime(item.lastMessage.createdAt)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className="text-[13.5px] tcy-dim truncate">
            {item.lastMessage ? lastMessagePreview(item) : subtitle}
          </span>
          <span className="flex items-center gap-1.5 shrink-0">
            {own && !item.unread && (
              <CheckCheck size={15} style={{ color: "var(--tcy-selected-accent)" }} />
            )}
            {item.membership.muted && (
              <VolumeX size={14} style={{ color: "var(--tcy-faint)" }} />
            )}
            {item.unread > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="tcy-unread-count min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center"
                style={
                  item.membership.muted
                    ? { background: "var(--tcy-card-strong)", color: "var(--tcy-dim)" }
                    : { background: "var(--tcy-selected-accent)", color: "var(--tcy-selected-on-accent)" }
                }
              >
                {item.unread > 99 ? "99+" : item.unread}
              </motion.span>
            )}
          </span>
        </div>
      </div>
      </motion.div>
    </div>
  );
}
