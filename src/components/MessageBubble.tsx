
import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { motion } from "framer-motion";
import { Check, CheckCheck, CornerUpLeft, FileText, Forward, Pencil, Reply } from "lucide-react";
import { Avatar } from "./Avatar";
import { VoiceMessage } from "./VoiceMessage";
import { AudioFilePlayer } from "./AudioFilePlayer";
import {
  useFileUrl,
  refreshFileUrl,
} from "@/hooks/useFileUrl";
import { formatFileSize, formatMessageTime } from "@/lib/format";
import type { MessageItem } from "@/types/api";
import { cn } from "@/lib/utils";
import { AppleEmoji, EmojiText } from "./AppleEmoji";
import { PollCard } from "./PollCard";

function isStandaloneEmoji(text: string) {
  const value = text.trim();
  return value.length > 0
    && value.length <= 32
    && !/\s/u.test(value)
    && /\p{Extended_Pictographic}/u.test(value)
    && !/[A-Za-z0-9]/.test(value);
}

function groupReactions(reactions: MessageItem["reactions"], myId: number) {
  type Reaction = MessageItem["reactions"][number];
  const map = new Map<string, { count: number; mine: boolean; reactors: Reaction[] }>();
  for (const r of reactions) {
    const cur = map.get(r.emoji) ?? { count: 0, mine: false, reactors: [] };
    cur.count++; cur.reactors.push(r);
    if (r.userId === myId) cur.mine = true;
    map.set(r.emoji, cur);
  }
  return [...map.entries()];
}

function MessageMeta({
  m,
  own,
  peerLastReadId,
  isImage,
  isStickerMessage,
  inCaptionFrame = false,
}: {
  m: MessageItem;
  own: boolean;
  peerLastReadId?: number;
  isImage: boolean;
  isStickerMessage: boolean;
  inCaptionFrame?: boolean;
}) {
  return (
    <span
      className="flex items-center justify-end gap-1 text-[10.5px] font-semibold mt-1 select-none"
      style={{
        color: inCaptionFrame
          ? own
            ? "color-mix(in srgb, var(--tcy-on-accent) 68%, transparent)"
            : "var(--tcy-faint)"
          : isImage || isStickerMessage
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
  );
}

function FileAttachment({
  m,
  own,
}: {
  m: MessageItem;
  own: boolean;
}) {
  const url = useFileUrl(m.attachmentKey);
  const attachmentName = m.attachmentName ?? "Аудиофайл";
  const isAudio = (m.attachmentMime ?? "").startsWith("audio/") || /\.(mp3|m4a|wav|ogg|opus|aac|flac|wma)$/i.test(attachmentName);
  if (isAudio) return <AudioFilePlayer url={url} name={attachmentName} size={m.attachmentSize} own={own} />;

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
  isChannel,
  showSender,
  peerLastReadId,
  onLongPress,
  onImageOpen,
  onStickerOpen,
  onReaction,
  onSwipeReply,
  highlighted = false,
}: {
  m: MessageItem;
  own: boolean;
  myId: number;
  isGroup: boolean;
  isChannel: boolean;
  showSender: boolean;
  peerLastReadId?: number;
  onLongPress: (m: MessageItem) => void;
  onImageOpen: (key: string) => void;
  onStickerOpen?: (m: MessageItem) => void;
  onReaction: (m: MessageItem, emoji: string) => void;
  onSwipeReply?: (m: MessageItem) => void;
  highlighted?: boolean;
}) {
  const imgUrl = useFileUrl(m.kind === "image" ? m.attachmentKey : null);
  const [imageUnavailable, setImageUnavailable] = useState(false);
  const [attachmentWidth, setAttachmentWidth] = useState<number | null>(null);
  const imageRetryKeyRef = useRef<string | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const swipeRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const swipeProgressRef = useRef(0);
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [swipeIndicatorX, setSwipeIndicatorX] = useState<number | null>(null);
  const swipeDirection = own ? 1 : -1;

  const handleSwipeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" || event.button !== 0) return;
    const target = event.target;
    if (target instanceof Element && target.closest("button, a, input, textarea, video, audio")) return;
    swipeRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    swipeProgressRef.current = 0;
    setSwipeProgress(0);
    setSwipeIndicatorX(null);
  };

  const handleSwipeMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = swipeRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx) * 0.9) {
      swipeRef.current = null;
      swipeProgressRef.current = 0;
      setSwipeProgress(0);
      setSwipeIndicatorX(null);
      return;
    }
    const directedDistance = dx * swipeDirection;
    const progress = Math.max(0, Math.min(1, directedDistance / 78));
    swipeProgressRef.current = progress;
    setSwipeProgress(progress);
    const rowRect = rowRef.current?.getBoundingClientRect();
    const bubbleRect = bubbleRef.current?.getBoundingClientRect();
    if (rowRect && bubbleRect && progress > 0.04) {
      setSwipeIndicatorX(own
        ? bubbleRect.left - rowRect.left - 36
        : bubbleRect.right - rowRect.left + 8);
      if (directedDistance > 8) event.preventDefault();
    } else {
      setSwipeIndicatorX(null);
    }
  };

  const finishSwipe = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!swipeRef.current || swipeRef.current.pointerId !== event.pointerId) return;
    const shouldReply = swipeProgressRef.current >= 0.94;
    swipeRef.current = null;
    swipeProgressRef.current = 0;
    setSwipeProgress(0);
    setSwipeIndicatorX(null);
    if (shouldReply) onSwipeReply?.(m);
  };

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
  const isStickerAttachment = isImage && !!m.attachmentName?.startsWith("tcy-sticker:");
  const isPoll = !!m.poll;
  const isStickerMessage = m.kind === "text" && !isPoll && isStandaloneEmoji(m.body ?? "");
  const hasMediaCaption = !!m.body && !m.poll && (isImage || m.kind === "file");

  const measureAttachment = (element: HTMLDivElement | null) => {
    if (!element) return;
    const width = Math.round(element.getBoundingClientRect().width);
    if (width > 0) setAttachmentWidth((current) => current === width ? current : width);
  };

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      data-message-id={m.id}
      ref={rowRef}
      className={cn(
        "relative flex px-3 my-[3px] w-full overflow-visible touch-pan-y",
        own ? "justify-end" : "justify-start",
        highlighted && "tcy-message-highlight",
      )}
    >
      {swipeProgress > 0.03 && swipeIndicatorX !== null && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute z-20"
          style={{ left: swipeIndicatorX, top: "50%", transform: "translateY(-50%)" }}
        >
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full border transition-colors"
            style={{
              background: swipeProgress >= 0.94
                ? "var(--tcy-selected-accent)"
                : `color-mix(in srgb, var(--tcy-selected-accent) ${Math.round(swipeProgress * 30)}%, var(--tcy-card))`,
              borderColor: swipeProgress >= 0.94 ? "var(--tcy-selected-accent)" : "var(--tcy-line-strong)",
              color: swipeProgress >= 0.94 ? "var(--tcy-selected-on-accent)" : "var(--tcy-dim)",
            }}
          >
            <Reply size={17} strokeWidth={2.4} />
          </span>
        </span>
      )}

      {isGroup && showSender && (!own || isChannel) && (
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
        ref={bubbleRef}
        onPointerDown={handleSwipeStart}
        onPointerMove={handleSwipeMove}
        onPointerUp={finishSwipe}
        onPointerCancel={finishSwipe}
        className={cn(
          "max-w-[78%] flex flex-col",
          own ? "items-end" : "items-start",
        )}
        style={{
          transform: swipeProgress > 0.015 ? `translateX(${swipeDirection * swipeProgress * 54}px)` : "translateX(0)",
          transition: swipeRef.current ? "none" : "transform 160ms ease-out",
        }}
      >
        <div
          onContextMenu={(e) => {
            e.preventDefault();
            onLongPress(m);
          }}
          onDoubleClick={() => onReaction(m, "❤️")}
          className={cn(
            "relative select-none cursor-default tcy-no-select",
            isImage || isPoll || isStickerMessage || hasMediaCaption ? "p-0 border-0 bg-transparent shadow-none" : "px-3.5 py-2.5",
            !isImage && !isPoll && !isStickerMessage && !hasMediaCaption &&
              (own
                ? "tcy-glass-own rounded-[22px] rounded-br-[8px]"
                : "tcy-glass-peer rounded-[22px] rounded-bl-[8px] border tcy-line"),
          )}
          style={
            isImage || isPoll || isStickerMessage || hasMediaCaption
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
          {isGroup && showSender && (!own || isChannel) && (
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
            <div
              ref={hasMediaCaption ? measureAttachment : undefined}
              data-photo-frame="true"
              className={cn(
                "inline-flex max-w-full flex-col overflow-hidden",
                isStickerAttachment
                  ? "items-center justify-center rounded-none border-0 p-0 shadow-none"
                  : "rounded-[18px] border tcy-line p-px tcy-shadow-soft",
              )}
            >
            <button
              type="button"
              onClick={() => {
                if (!m.attachmentKey) return;
                if (imageUnavailable) {
                  imageRetryKeyRef.current = null;
                  setImageUnavailable(false);
                  refreshFileUrl(m.attachmentKey);
                  return;
                }
                if (m.attachmentName?.startsWith("tcy-sticker:")) {
                  onStickerOpen?.(m);
                  return;
                }
                onImageOpen(m.attachmentKey);
              }}
              className={cn(
                "block max-w-full p-0 border-0 bg-transparent appearance-none text-left",
                isStickerAttachment ? "rounded-[18px]" : "rounded-t-[15px] rounded-b-none",
              )}
              aria-label={imageUnavailable ? "Повторить загрузку фотографии" : isStickerAttachment ? "Открыть действия стикера" : "Открыть фотографию"}
            >
              {imgUrl && !imageUnavailable ? (
                <img
                  src={imgUrl}
                  alt={m.attachmentName ?? "Фото"}
                  className={cn(
                    "block",
                    isStickerAttachment
                      ? "h-[180px] w-[180px] object-contain"
                      : "rounded-t-[14px] rounded-b-none max-w-[240px] max-h-[300px] object-cover",
                  )}
                  loading="lazy"
                  decoding="async"
                  onError={() => {
                    const key = m.attachmentKey;
                    if (!key) {
                      setImageUnavailable(true);
                      return;
                    }
                    if (imageRetryKeyRef.current === key) {
                      setImageUnavailable(true);
                      return;
                    }
                    // One automatic retry avoids endless loops when the stored
                    // object really is missing. Clicking the placeholder retries manually.
                    imageRetryKeyRef.current = key;
                    refreshFileUrl(key);
                  }}
                  onLoad={(event) => {
                    const frame = event.currentTarget.closest<HTMLElement>("[data-photo-frame]");
                    if (frame) setAttachmentWidth(Math.round(frame.getBoundingClientRect().width));
                    imageRetryKeyRef.current = null;
                    setImageUnavailable(false);
                  }}
                />
              ) : imageUnavailable ? (
                <div className="w-[220px] h-[120px] rounded-[13px] tcy-card flex flex-col items-center justify-center gap-2 px-3 text-center">
                  <FileText size={22} className="tcy-faint" />
                  <span className="text-[12px] font-semibold tcy-dim">Фото не загрузилось</span>
                  <span className="text-[11px] tcy-faint">Нажмите, чтобы повторить</span>
                </div>
              ) : (
                <div className={cn("tcy-skeleton rounded-[13px]", isStickerAttachment ? "w-[180px] h-[180px]" : "w-[220px] h-[160px]")} />
              )}
            </button>
            {hasMediaCaption && (
              <div
                className="w-full min-w-0 rounded-none px-3 py-2.5"
                style={{
                  boxSizing: "border-box",
                  background: own ? "var(--tcy-accent)" : "var(--tcy-bubble-in)",
                  color: own ? "var(--tcy-on-accent)" : "var(--tcy-text)",
                }}
              >
                <p className="text-[15px] leading-[1.4] whitespace-pre-wrap break-words">
                  <EmojiText text={m.body} />
                </p>
                <MessageMeta
                  m={m}
                  own={own}
                  peerLastReadId={peerLastReadId}
                  isImage={isImage}
                  isStickerMessage={isStickerMessage}
                  inCaptionFrame
                />
              </div>
            )}
            </div>
          )}

          {m.kind === "file" && (
            <div
              ref={hasMediaCaption ? measureAttachment : undefined}
              className={hasMediaCaption ? "w-fit max-w-full rounded-[18px] border tcy-line px-3.5 py-2.5" : undefined}
              style={hasMediaCaption
                ? own
                  ? { background: "var(--tcy-accent)", color: "var(--tcy-on-accent)" }
                  : { background: "var(--tcy-bubble-in)", color: "var(--tcy-text)" }
                : undefined}
            >
              <FileAttachment m={m} own={own} />
            </div>
          )}

          {m.kind === "voice" && (
            <VoiceMessage
              attachmentKey={m.attachmentKey}
              voiceMeta={m.voiceMeta}
              own={own}
            />
          )}

          {m.poll && <PollCard poll={m.poll} own={own} />}

          {m.body && !m.poll && (
            isStickerMessage ? (
              <div className="px-1 py-1">
                <AppleEmoji emoji={m.body.trim()} size={58} />
              </div>
            ) : hasMediaCaption && !isImage ? (
              <div
                className="mt-0 w-fit max-w-full rounded-b-[14px] rounded-t-none border-x border-b border-t-0 tcy-line px-3 py-2.5 tcy-shadow-soft"
                style={{
                  width: attachmentWidth ?? 200,
                  maxWidth: "100%",
                  boxSizing: "border-box",
                  background: own ? "var(--tcy-accent)" : "var(--tcy-bubble-in)",
                  color: own ? "var(--tcy-on-accent)" : "var(--tcy-text)",
                }}
              >
                <p className="text-[15px] leading-[1.4] whitespace-pre-wrap break-words">
                  <EmojiText text={m.body} />
                </p>
                <MessageMeta
                  m={m}
                  own={own}
                  peerLastReadId={peerLastReadId}
                  isImage={isImage}
                  isStickerMessage={isStickerMessage}
                  inCaptionFrame
                />
              </div>
            ) : (
              <p className="text-[15px] leading-[1.4] whitespace-pre-wrap break-words">
                <EmojiText text={m.body} />
              </p>
            )
          )}

          {!hasMediaCaption && (
            <MessageMeta
              m={m}
              own={own}
              peerLastReadId={peerLastReadId}
              isImage={isImage}
              isStickerMessage={isStickerMessage}
            />
          )}

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
                  <span className="flex items-center -space-x-1 mr-0.5" aria-label="Кто поставил реакцию">
                    {info.reactors.slice(0, 2).map((reactor) => <Avatar key={reactor.userId} name={reactor.displayName} avatarKey={reactor.avatarKey} size={16} className="border-2 border-[color:var(--tcy-solid)]" />)}
                  </span>
                  <AppleEmoji emoji={emoji} size={15} />
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
