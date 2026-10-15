import { useRef } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { motion } from "framer-motion";
import { Pin, VolumeX, Check, CheckCheck, Image as ImageIcon, FileText, Mic, Star } from "lucide-react";
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
  onClick,
  onAvatarClick,
  index,
  selected = false,
  selecting = false,
  onToggleSelect,
  onLongPress,
}: {
  item: ChatListItem;
  onClick: () => void;
  onAvatarClick?: () => void;
  index: number;
  selected?: boolean;
  selecting?: boolean;
  onToggleSelect?: () => void;
  onLongPress?: () => void;
}) {
  const isDirect = item.chat.type === "direct";
  const directParts = item.chat.directKey?.split(":") ?? [];
  const isFavorites = isDirect && directParts.length === 2 && directParts[0] === directParts[1];
  const title = isFavorites ? "Избранное" : isDirect ? item.peer?.displayName ?? "Пользователь" : item.chat.title ?? "Группа";
  const subtitle = isFavorites ? "Личные сохранённые сообщения" : isDirect ? `@${item.peer?.username ?? ""}` : `${item.membersCount} участн.`;
  const own =
    item.lastMessage && item.peer && item.lastMessage.senderId !== item.peer.userId;
  const pressTimer = useRef<number | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggered = useRef(false);

  const clearPressTimer = () => {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    longPressTriggered.current = false;
    pressStart.current = { x: event.clientX, y: event.clientY };
    clearPressTimer();
    if (selecting) return;

    pressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      onLongPress?.();
      if ("vibrate" in navigator) navigator.vibrate?.(12);
    }, 460);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pressStart.current || pressTimer.current === null) return;
    if (Math.hypot(event.clientX - pressStart.current.x, event.clientY - pressStart.current.y) > 12) {
      clearPressTimer();
      pressStart.current = null;
    }
  };

  const handlePointerEnd = () => {
    clearPressTimer();
    pressStart.current = null;
  };

  const handleRowClick = () => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    if (selecting) onToggleSelect?.();
    else onClick();
  };

  const handleAvatarClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    if (selecting) onToggleSelect?.();
    else onAvatarClick?.();
  };

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-pressed={selecting ? selected : undefined}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.035, 0.3), type: "spring", stiffness: 300, damping: 30 }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onContextMenu={(event) => event.preventDefault()}
      onClick={handleRowClick}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleRowClick();
        }
      }}
      className={`tcy-chat-list-item w-full flex items-center gap-3.5 px-4 py-3 text-left transition-colors ${selected ? "tcy-chat-list-item-selected" : ""}`}
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
      <button
        type="button"
        aria-label={isDirect ? `Открыть аватар пользователя ${title}` : `Открыть аватар ${title}`}
        onClick={handleAvatarClick}
        className="tcy-press rounded-full shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--tcy-selected-accent)]"
      >
        {isFavorites ? (
          <span className="tcy-favorite-chat-avatar flex h-[54px] w-[54px] items-center justify-center rounded-[30%]">
            <Star size={25} fill="currentColor" strokeWidth={1.6} />
          </span>
        ) : (
          <Avatar
            name={title}
            avatarKey={isDirect ? item.peer?.avatarKey : item.chat.avatarKey}
            size={54}
            lastSeenAt={isDirect ? item.peer?.lastSeenAt : null}
            showOnline={isDirect}
          />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-bold text-[15.5px] tcy-text truncate flex items-center gap-1.5">
            {title}
            {isDirect && isTesterUsername(item.peer?.username) && <TesterBadge />}
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
                className="min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center"
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
  );
}
