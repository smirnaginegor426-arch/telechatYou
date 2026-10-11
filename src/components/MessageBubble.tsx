
import { motion } from "framer-motion";
import { Check, CheckCheck, CornerUpLeft, FileText, Forward, Pencil } from "lucide-react";
import { Avatar } from "./Avatar";
import { VoiceMessage } from "./VoiceMessage";
import {
  useFileUrl,
  refreshFileUrl,
} from "@/hooks/useFileUrl";
import { formatFileSize, formatMessageTime } from "@/lib/format";
import type { MessageItem } from "@/types/api";
import { cn } from "@/lib/utils";

function groupReactions(
  reactions: { emoji: string; userId: number }[],
  myId: number,
) {
  const map = new Map<string, { count: number; mine: boolean }>();

  for (const r of reactions) {
    const cur = map.get(r.emoji) ?? { count: 0, mine: false };
    cur.count++;

    if (r.userId === myId) cur.mine = true;
    map.set(r.emoji, cur);
  }

  return [...map.entries()];
}

function FileAttachment({
  m,
  own,
}: {
  m: MessageItem;
  own: boolean;
}) {
  const url = useFileUrl(m.attachmentKey);

  return (
    <a
      href={url ?? "#"}
      target="_blank"
      rel="noreferrer"
      download={m.attachmentName ?? true}
      onClick={(e) => !url && e.preventDefault()}
      className="flex items-center gap-3 min-w-[200px] py-0.5"
    >
      <span
        className="w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0"
        style={{
          background: own
            ? "color-mix(in srgb, var(--tcy-on-accent) 18%, transparent)"
            : "var(--tcy-card-strong)",
          color: own ? "var(--tcy-on-accent)" : "var(--tcy-accent)",
        }}
      >
        <FileText size={18} />
      </span>

      <span className="min-w-0">
        <span className="block text-[14px] font-semibold truncate max-w-[180px]">
          {m.attachmentName ?? "Файл"}
        </span>
        <span
          className="block text-[11.5px] font-medium"
          style={{
            color: own
              ? "color-mix(in srgb, var(--tcy-on-accent) 60%, transparent)"
              : "var(--tcy-faint)",
          }}
        >
          {formatFileSize(m.attachmentSize)}
        </span>
      </span>
    </a>
  );
}

export function MessageBubble({
  m,
  own,
  myId,
  isGroup,
  showSender,
  peerLastReadId,
  onLongPress,
  onImageOpen,
  onReaction,
}: {
  m: MessageItem;
  own: boolean;
  myId: number;
  isGroup: boolean;
  showSender: boolean;
  peerLastReadId?: number;
  onLongPress: (m: MessageItem) => void;
  onImageOpen: (key: string) => void;
  onReaction: (m: MessageItem, emoji: string) => void;
}) {
  const imgUrl = useFileUrl(m.kind === "image" ? m.attachmentKey : null);

  if (m.kind === "system") {
    return (
      <div className="flex justify-center my-2.5 px-6">
        <span className="text-[12px] font-semibold tcy-dim tcy-card px-3.5 py-1.5 rounded-full text-center">
          {m.body}
        </span>
      </div>
    );
  }

  if (m.deletedAt) {
    return (
      <div
        className={cn(
          "flex px-4 my-[3px]",
          own ? "justify-end" : "justify-start",
        )}
      >
        <span className="text-[13px] italic tcy-faint px-4 py-2.5 rounded-[20px] border border-dashed tcy-line">
          Сообщение удалено
        </span>
      </div>
    );
  }

  const reactions = groupReactions(m.reactions, myId);
  const isImage = m.kind === "image";

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className={cn(
        "flex px-3 my-[3px] w-full",
        own ? "justify-end" : "justify-start",
      )}
    >
      {isGroup && !own && (
        <div className="w-8 mr-1.5 shrink-0 flex items-end">
          {showSender && (
            <Avatar
              name={m.sender?.displayName ?? "?"}
              avatarKey={m.sender?.avatarKey}
              size={28}
            />
          )}
        </div>
      )}

      <div
        className={cn(
          "max-w-[78%] flex flex-col",
          own ? "items-end" : "items-start",
        )}
      >
        <div
          onContextMenu={(e) => {
            e.preventDefault();
            onLongPress(m);
          }}
          onDoubleClick={() => onReaction(m, "❤️")}
          className={cn(
            "relative select-none cursor-default",
            isImage ? "p-0 border-0 bg-transparent shadow-none" : "px-3.5 py-2.5",
            !isImage &&
              (own
                ? "tcy-gradient-accent rounded-[22px] rounded-br-[8px]"
                : "rounded-[22px] rounded-bl-[8px] border tcy-line"),
          )}
          style={
            isImage
              ? {
                  background: "transparent",
                  color: "var(--tcy-text)",
                }
              : own
                ? { color: "var(--tcy-on-accent)" }
                : {
                    background: "var(--tcy-bubble-in)",
                    color: "var(--tcy-text)",
                  }
          }
        >
          {isGroup && !own && showSender && (
            <div className="text-[12.5px] font-bold mb-0.5 tcy-accent">
              {m.sender?.displayName ?? "Участник"}
            </div>
          )}

          {m.forwardedFromName && (
            <div className="flex items-center gap-1.5 text-[12px] font-semibold mb-1 opacity-80">
              <Forward size={12} />
              Переслано от {m.forwardedFromName}
            </div>
          )}

          {m.replyTo && (
            <div
              className="flex gap-2 items-stretch mb-1.5 rounded-[12px] px-2.5 py-1.5"
              style={{
                background: own
                  ? "color-mix(in srgb, var(--tcy-on-accent) 12%, transparent)"
                  : "var(--tcy-card)",
              }}
            >
              <span
                className="w-[3px] rounded-full shrink-0"
                style={{
                  background: own
                    ? "var(--tcy-on-accent)"
                    : "var(--tcy-accent)",
                }}
              />

              <span className="min-w-0">
                <span className="block text-[12px] font-bold opacity-90">
                  {m.replyTo.sender?.displayName ?? "Сообщение"}
                </span>

                <span className="block text-[12.5px] opacity-75 truncate max-w-[200px]">
                  {m.replyTo.kind === "voice"
                    ? "Голосовое сообщение"
                    : m.replyTo.kind === "image"
                      ? "Фото"
                      : m.replyTo.kind === "file"
                        ? (m.replyTo.attachmentName ?? "Файл")
                        : m.replyTo.body}
                </span>
              </span>
            </div>
          )}

          {isImage && (
            <button
              type="button"
              onClick={() => {
                if (m.attachmentKey) onImageOpen(m.attachmentKey);
              }}
              className="block mb-1 p-0 border-0 bg-transparent appearance-none"
            >
              {imgUrl ? (
                <img
                  src={imgUrl}
                  alt={m.attachmentName ?? "Фото"}
                  className="rounded-[16px] max-w-[240px] max-h-[300px] object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="tcy-skeleton w-[220px] h-[160px] rounded-[16px]" />
              )}
            </button>
          )}

          {m.kind === "file" && <FileAttachment m={m} own={own} />}

          {m.kind === "voice" && (
            <VoiceMessage
              attachmentKey={m.attachmentKey}
              voiceMeta={m.voiceMeta}
              own={own}
            />
          )}

          {m.body && (
            <p className="text-[15px] leading-[1.4] whitespace-pre-wrap break-words">
              {m.body}
            </p>
          )}

          <span
            className={cn(
              "flex items-center gap-1 text-[10.5px] font-semibold mt-0.5 select-none",
              "justify-end",
            )}
            style={{
              color: isImage
                ? "var(--tcy-faint)"
                : own
                  ? "color-mix(in srgb, var(--tcy-on-accent) 62%, transparent)"
                  : "var(--tcy-faint)",
            }}
          >
            {m.editedAt && (
              <span className="inline-flex items-center gap-0.5">
                <Pencil size={9} /> ред.
              </span>
            )}

            {formatMessageTime(m.createdAt)}

            {own && (
              <span className="ml-0.5 -mr-0.5">
                {(peerLastReadId ?? 0) >= m.id ? (
                  <CheckCheck size={13} strokeWidth={2.4} />
                ) : (
                  <Check size={13} strokeWidth={2.4} />
                )}
              </span>
            )}
          </span>

          {reactions.length > 0 && (
            <div
              className={cn(
                "absolute -bottom-3.5 flex gap-1",
                own ? "right-2" : "left-2",
              )}
            >
              {reactions.map(([emoji, info]) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onReaction(m, emoji)}
                  className="tcy-press flex items-center gap-0.5 px-1.5 h-6 rounded-full text-[12px] border tcy-line tcy-solid tcy-shadow-soft"
                  style={
                    info.mine
                      ? {
                          borderColor: "var(--tcy-accent)",
                          color: "var(--tcy-text)",
                        }
                      : { color: "var(--tcy-text)" }
                  }
                >
                  {emoji}
                  {info.count > 1 && (
                    <span className="text-[10px] font-bold">
                      {info.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {reactions.length > 0 && <div className="h-4" />}
      </div>
    </motion.div>
  );
}

export function ReplyPreviewBar({
  m,
  onClose,
}: {
  m: MessageItem;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-2 tcy-solid-2 border-t tcy-line">
      <CornerUpLeft
        size={16}
        style={{ color: "var(--tcy-accent)" }}
        className="shrink-0"
      />

      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-bold tcy-accent">
          {m.sender?.displayName ?? "Сообщение"}
        </div>

        <div className="text-[12.5px] tcy-dim truncate">
          {m.kind === "voice"
            ? "Голосовое сообщение"
            : m.kind === "image"
              ? "Фото"
              : m.body}
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="tcy-press tcy-faint text-lg px-2"
      >
        ✕
      </button>
    </div>
  );
}
