import { motion } from "framer-motion";
import { Pin, VolumeX, Check, CheckCheck, Image as ImageIcon, FileText, Mic } from "lucide-react";
import { Avatar } from "./Avatar";
import { SwipeableRow } from "./SwipeableRow";
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
  onPin,
  onMute,
  onRead,
  onDelete,
  onAvatarClick,
  index,
}: {
  item: ChatListItem;
  onClick: () => void;
  onPin: () => void;
  onMute: () => void;
  onRead: () => void;
  onDelete: () => void;
  onAvatarClick?: () => void;
  index: number;
}) {
  const isDirect = item.chat.type === "direct";
  const title = isDirect ? item.peer?.displayName ?? "Пользователь" : item.chat.title ?? "Группа";
  const subtitle = isDirect ? `@${item.peer?.username ?? ""}` : `${item.membersCount} участн.`;
  const own =
    item.lastMessage && item.peer && item.lastMessage.senderId !== item.peer.userId;

  return (
    <SwipeableRow
      actions={[
        {
          key: "read",
          icon: <Check size={19} />,
          color: "#0e9f76",
          onTrigger: onRead,
        },
        {
          key: "mute",
          icon: <VolumeX size={19} />,
          color: "#6b7280",
          onTrigger: onMute,
        },
        {
          key: "pin",
          icon: <Pin size={19} />,
          color: "#334155",
          onTrigger: onPin,
        },
        {
          key: "del",
          icon: <span className="text-[13px] font-bold">✕</span>,
          color: "#b0413e",
          onTrigger: onDelete,
        },
      ]}
    >
      <motion.div
        role="button"
        tabIndex={0}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index * 0.035, 0.3), type: "spring", stiffness: 300, damping: 30 }}
        onClick={onClick}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onClick();
          }
        }}
        className="tcy-chat-list-item w-full flex items-center gap-3.5 px-4 py-3 text-left active:bg-[color:var(--tcy-card)] transition-colors"
      >
        <button type="button"
          aria-label={isDirect ? `Открыть аватар пользователя ${title}` : `Открыть аватар ${title}`}
          onClick={(event) => { event.stopPropagation(); onAvatarClick?.(); }}
          className="tcy-press rounded-full shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--tcy-accent)]">
          <Avatar
            name={title}
            avatarKey={isDirect ? item.peer?.avatarKey : item.chat.avatarKey}
            size={54}
            lastSeenAt={isDirect ? item.peer?.lastSeenAt : null}
            showOnline={isDirect}
          />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-bold text-[15.5px] tcy-text truncate flex items-center gap-1.5">
              {title}
              {item.membership.pinned && (
                <Pin size={12} style={{ color: "var(--tcy-faint)" }} className="shrink-0 rotate-45" />
              )}
            </span>
            {item.lastMessage && (
              <span
                className="text-[11.5px] font-semibold shrink-0"
                style={{
                  color: item.unread > 0 && !item.membership.muted ? "var(--tcy-accent)" : "var(--tcy-faint)",
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
                <CheckCheck size={15} style={{ color: "var(--tcy-accent)" }} />
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
                      : { background: "var(--tcy-accent)", color: "var(--tcy-on-accent)" }
                  }
                >
                  {item.unread > 99 ? "99+" : item.unread}
                </motion.span>
              )}
            </span>
          </div>
        </div>
      </motion.div>
    </SwipeableRow>
  );
}
