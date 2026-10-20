
import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { motion } from "framer-motion";
import { Check, CheckCheck, CornerUpLeft, Download, Eye, FileText, Forward, LoaderCircle, MessageCircle, Pencil, Play } from "lucide-react";
import { Avatar } from "./Avatar";
import { VoiceMessage } from "./VoiceMessage";
import { MusicFilePlayer } from "./MusicFilePlayer";
import {
  useFileUrl,
  refreshFileUrl,
} from "@/hooks/useFileUrl";
import { formatFileSize, formatMessageTime } from "@/lib/format";
import type { MessageItem } from "@/types/api";
import { cn } from "@/lib/utils";
import { AppleEmoji } from "./AppleEmoji";
import { MessageText } from "./MessageText";
import { LinkPreview } from "./LinkPreview";
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
  isChannel = false,
  inCaptionFrame = false,
}: {
  m: MessageItem;
  own: boolean;
  peerLastReadId?: number;
  isImage: boolean;
  isStickerMessage: boolean;
  isChannel?: boolean;
  inCaptionFrame?: boolean;
}) {
  return (
    <span
      className="flex items-center justify-end gap-1 text-[10.5px] font-semibold mt-1 select-none"
      style={{
        color: inCaptionFrame
          ? own
            ? "var(--tcy-bubble-own-muted)"
            : "var(--tcy-dim)"
          : isImage || isStickerMessage
            ? "var(--tcy-faint)"
            : own
              ? "var(--tcy-bubble-own-muted)"
              : "var(--tcy-dim)",
      }}
    >
      {m.editedAt && (
        <span className="inline-flex items-center gap-0.5">
          <Pencil size={9} /> ред.
        </span>
      )}
      {formatMessageTime(m.createdAt)}
      {isChannel && (
        <span
          className="ml-1 inline-flex items-center gap-0.5"
          title={`Просмотров: ${m.viewCount ?? 0}`}
          aria-label={`Просмотров: ${m.viewCount ?? 0}`}
        >
          <Eye size={11} strokeWidth={2.1} />
          {m.viewCount ?? 0}
        </span>
      )}
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
  onVideoOpen,
}: {
  m: MessageItem;
  own: boolean;
  onVideoOpen?: (key: string) => void;
}) {
  const url = useFileUrl(m.attachmentKey);
  const attachmentName = m.attachmentName ?? "Медиафайл";
  const attachmentMime = m.attachmentMime ?? "";
  const isAudio = attachmentMime.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|opus|aac|flac|wma|weba|amr|aiff?|caf)$/i.test(attachmentName);
  const isVideo = attachmentMime.startsWith("video/") || /\.(mp4|m4v|mov|webm|mkv|avi|3gp|ogv|mpeg|mpg|flv|ts)$/i.test(attachmentName);
  const [videoPreviewReady, setVideoPreviewReady] = useState(false);
  const [videoPreviewFailed, setVideoPreviewFailed] = useState(false);
  if (isVideo) {
    return (
      <button
        type="button"
        onClick={() => {
          // Do not wait for the preview URL: the full-screen viewer resolves it itself.
          if (!m.attachmentKey) return;
          onVideoOpen?.(m.attachmentKey);
        }}
        aria-label="Открыть видео"
        className="tcy-press relative block h-[280px] max-h-[44vh] w-[min(158px,48vw)] min-w-[130px] overflow-hidden rounded-none border-0 outline-none ring-0 bg-transparent p-0 shadow-none"
      >
        {url && !videoPreviewFailed ? (
          <video
            src={url}
            muted
            playsInline
            preload="metadata"
            tabIndex={-1}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full object-contain"
            onLoadedData={(event) => {
              setVideoPreviewReady(true);
              try {
                if (event.currentTarget.duration > 0) event.currentTarget.currentTime = Math.min(0.08, event.currentTarget.duration);
              } catch { /* Keep the first available frame. */ }
            }}
            onError={() => {
              setVideoPreviewFailed(true);
              setVideoPreviewReady(false);
            }}
          />
        ) : (
          <span className="absolute inset-0 bg-black" />
        )}
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15">
          {!videoPreviewReady && !videoPreviewFailed ? (
            <span className="flex h-[54px] w-[54px] items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm">
              <LoaderCircle size={25} className="animate-spin" />
            </span>
          ) : (
            <span className="flex h-[54px] w-[54px] items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm">
              <Play size={25} fill="currentColor" className="ml-0.5" />
            </span>
          )}
        </span>
      </button>
    );
  }

  if (isAudio) {
    return (
      <MusicFilePlayer
        url={url}
        name={attachmentName}
        own={own}
        mime={attachmentMime}
      />
    );
  }

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
            ? "color-mix(in srgb, var(--tcy-bubble-own-fg) 16%, transparent)"
            : "var(--tcy-card-strong)",
          color: own ? "var(--tcy-bubble-own-fg)" : "var(--tcy-accent)",
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
              ? "var(--tcy-bubble-own-muted)"
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
  onVideoOpen,
  onStickerOpen,
  onReaction,
  onSwipeReply,
  showChannelComments = false,
  channelCommentsCount = 0,
  onOpenChannelComments,
  onContextAction,
  onSelectToggle,
  highlighted = false,
  selected = false,
  selectionMode = false,
  experimental = false,
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
  onVideoOpen?: (key: string) => void;
  onStickerOpen?: (m: MessageItem) => void;
  onReaction: (m: MessageItem, emoji: string) => void;
  onSwipeReply?: (m: MessageItem) => void;
  /** Keep the comments action visually attached to the channel post. */
  showChannelComments?: boolean;
  channelCommentsCount?: number;
  onOpenChannelComments?: () => void;
  onContextAction?: (m: MessageItem) => void;
  onSelectToggle?: (m: MessageItem) => void;
  highlighted?: boolean;
  selected?: boolean;
  selectionMode?: boolean;
  /** Private experimental spacing (calm refresh); stable accounts keep the old metrics. */
  experimental?: boolean;
}) {
  const imgUrl = useFileUrl(m.kind === "image" ? m.attachmentKey : null);
  const [imageUnavailable, setImageUnavailable] = useState(false);
  const [imageDownloaded, setImageDownloaded] = useState(false);
  const [imageDownloading, setImageDownloading] = useState(false);
  const [attachmentWidth, setAttachmentWidth] = useState<number | null>(null);
  const imageRetryKeyRef = useRef<string | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const swipeRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const swipeProgressRef = useRef(0);
  const longPressRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [swipeIndicatorX, setSwipeIndicatorX] = useState<number | null>(null);
  const swipeDirection = own ? 1 : -1;

  const cancelLongPress = () => {
    if (longPressTimerRef.current !== null) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };

  const handleBubblePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" || event.button !== 0 || selectionMode) return;
    const target = event.target;
    if (target instanceof Element && target.closest("button, a, input, textarea, video, audio")) return;
    longPressTriggeredRef.current = false;
    longPressRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    cancelLongPress();
    longPressTimerRef.current = window.setTimeout(() => {
      if (longPressRef.current?.pointerId !== event.pointerId) return;
      longPressTriggeredRef.current = true;
      onLongPress(m);
    }, 480);
  };

  const handleBubblePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = longPressRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    if (Math.abs(event.clientX - start.x) > 10 || Math.abs(event.clientY - start.y) > 10) {
      cancelLongPress();
    }
  };

  const handleBubblePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (longPressRef.current?.pointerId !== event.pointerId) return;
    cancelLongPress();
    longPressRef.current = null;
  };

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
          experimental ? "flex px-4 my-[4px]" : "flex px-4 my-[3px]",
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
  const isVideoAttachment = m.kind === "file" && (
    (m.attachmentMime ?? "").startsWith("video/") ||
    /\.(mp4|m4v|mov|webm|mkv|avi|3gp|ogv|mpeg|mpg|flv|ts)$/i.test(m.attachmentName ?? "")
  );
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
      style={selected ? {
        background: "color-mix(in srgb, var(--tcy-selected-accent) 12%, transparent)",
        outline: "1px solid var(--tcy-selected-accent)",
        outlineOffset: "-1px",
        borderRadius: "22px",
      } : undefined}
      onClickCapture={selectionMode ? (event) => {
        // Explicit links must remain clickable even while message-selection mode is active.
        if (event.target instanceof Element && event.target.closest("a")) return;
        if (longPressTriggeredRef.current) {
          longPressTriggeredRef.current = false;
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        onSelectToggle?.(m);
      } : undefined}
      onPointerDown={handleSwipeStart}
      onPointerMove={handleSwipeMove}
      onPointerUp={finishSwipe}
      onPointerCancel={finishSwipe}
      className={cn(
        experimental ? "relative flex px-3 my-[4px] w-full overflow-visible touch-pan-y" : "relative flex px-3 my-[3px] w-full overflow-visible touch-pan-y",
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
            className="flex h-8 w-8 items-center justify-center rounded-full p-[2px]"
            style={{
              background: `conic-gradient(var(--tcy-selected-accent) 0deg ${Math.round(swipeProgress * 360)}deg, var(--tcy-line-strong) ${Math.round(swipeProgress * 360)}deg 360deg)`,
            }}
          >
            <span
              className="block h-full w-full rounded-full"
              style={{
                background: swipeProgress >= 0.94 ? "var(--tcy-selected-accent)" : "var(--tcy-card)",
                border: swipeProgress >= 0.94 ? "none" : "1px solid var(--tcy-line)",
              }}
            />
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
        className={cn(
          "h-fit w-fit max-w-[78%] min-w-0 flex flex-col self-start",
          own ? "items-end" : "items-start",
          isChannel && showChannelComments && "rounded-[22px] border tcy-line tcy-shadow-soft",
        )}
        style={{
          transform: swipeProgress > 0.015 ? `translateX(${swipeDirection * swipeProgress * 54}px)` : "translateX(0)",
          transition: swipeRef.current ? "none" : "transform 160ms ease-out",
          ...(isChannel && showChannelComments
            ? { background: "var(--tcy-bubble-in)", borderColor: "var(--tcy-line)" }
            : {}),
        }}
      >
        <div
          onPointerDown={handleBubblePointerDown}
          onPointerMove={handleBubblePointerMove}
          onPointerUp={handleBubblePointerUp}
          onPointerCancel={handleBubblePointerUp}
          onContextMenu={(e) => {
            e.preventDefault();
            if (longPressTriggeredRef.current) return;
            if (longPressRef.current) {
              longPressTriggeredRef.current = true;
              cancelLongPress();
              onLongPress(m);
              return;
            }
            onContextAction?.(m);
          }}
          onDoubleClick={() => { if (!selectionMode) onReaction(m, "❤️"); }}
          className={cn(
            "relative h-fit w-fit max-w-full select-none cursor-default tcy-no-select",
            isImage || isPoll || isStickerMessage || hasMediaCaption || isVideoAttachment
              ? "p-0 border-0 bg-transparent shadow-none"
              : experimental
                ? "px-4 py-2.5"
                : "px-3.5 py-2.5",
            isChannel && showChannelComments
              ? "bg-transparent border-0 shadow-none rounded-none px-3 py-1.5"
              : !isImage && !isPoll && !isStickerMessage && !hasMediaCaption && !isVideoAttachment &&
                (own
                  ? "tcy-glass-own rounded-[22px] rounded-br-[8px]"
                  : "tcy-glass-peer rounded-[22px] rounded-bl-[8px] border tcy-line"),
          )}
          style={
            isChannel && showChannelComments
              ? { background: "transparent", color: "var(--tcy-text)" }
              : isImage || isPoll || isStickerMessage || hasMediaCaption || isVideoAttachment
                ? {
                    background: "transparent",
                    color: "var(--tcy-text)",
                  }
                : own
                  ? { color: "var(--tcy-bubble-own-fg)" }
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
                  ? "color-mix(in srgb, var(--tcy-bubble-own-fg) 12%, transparent)"
                  : "var(--tcy-card)",
              }}
            >
              <span
                className="w-[3px] rounded-full shrink-0"
                style={{
                  background: own
                    ? "var(--tcy-bubble-own-fg)"
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
                  : "rounded-[18px] border-solid p-0 tcy-shadow-soft",
              )}
              style={isStickerAttachment ? undefined : {
                borderWidth: "1mm",
                borderColor: "var(--tcy-line)",
              }}
            >
            <button
              type="button"
              onClick={async () => {
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
                if (!imageDownloaded) {
                  setImageDownloading(true);
                  try {
                    const response = await fetch(imgUrl ?? "");
                    if (!response.ok) throw new Error("download failed");
                    const blob = await response.blob();
                    if (!blob.size) throw new Error("empty image");
                    const objectUrl = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = objectUrl;
                    link.download = m.attachmentName || "photo";
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
                    setImageDownloaded(true);
                  } catch {
                    // Open the viewer even if the browser blocks saving the file.
                  } finally {
                    setImageDownloading(false);
                  }
                }
                onImageOpen(m.attachmentKey);
              }}
              className={cn(
                "relative block max-w-full p-0 border-0 bg-transparent appearance-none text-left",
                isStickerAttachment ? "rounded-[18px]" : "rounded-none",
              )}
              aria-label={imageUnavailable ? "Повторить загрузку фотографии" : isStickerAttachment ? "Открыть действия стикера" : "Открыть фотографию"}
            >
              {imgUrl && !imageUnavailable ? (
                <img
                  src={imgUrl}
                  alt={m.attachmentName ?? "Фото"}
                  className={cn(
                    "block transition-[filter] duration-300",
                    isStickerAttachment
                      ? "h-[180px] w-[180px] object-contain"
                      : "max-w-[240px] max-h-[300px] rounded-b-[14px] object-cover",
                    !isStickerAttachment && !imageDownloaded && "blur-md scale-[1.03]",
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
              {!isStickerAttachment && imgUrl && !imageUnavailable && !imageDownloaded && (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="absolute inset-0 bg-black/10" />
                  <span className="relative z-[1] flex h-[54px] w-[54px] items-center justify-center rounded-full border border-white/45 bg-black/45 text-white shadow-lg backdrop-blur-md">
                    {imageDownloading ? <LoaderCircle size={23} className="animate-spin" /> : <Download size={23} strokeWidth={2.5} />}
                  </span>
                </span>
              )}
            </button>
            {hasMediaCaption && (
              <div
                className="relative -mt-px block w-full min-w-0 rounded-t-[14px] rounded-b-[15px] px-3 py-2.5"
                style={{
                  boxSizing: "border-box",
                  background: own ? "var(--tcy-bubble-own-bg)" : "var(--tcy-bubble-in)",
                  color: own ? "var(--tcy-bubble-own-fg)" : "var(--tcy-text)",
                }}
              >
                <p className="tcy-msg-body text-[15px] leading-[1.5] whitespace-pre-wrap break-words">
                  <MessageText text={m.body ?? ""} />
                </p>
                <LinkPreview text={m.body ?? ""} own={own} enabled />
                <MessageMeta
                  m={m}
                  own={own}
                  isChannel={isChannel}
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
              className={hasMediaCaption && !isVideoAttachment ? "w-fit max-w-full rounded-[18px] border tcy-line px-3.5 py-2.5" : undefined}
              style={hasMediaCaption && !isVideoAttachment
                ? own
                  ? { background: "var(--tcy-bubble-own-bg)", color: "var(--tcy-bubble-own-fg)" }
                  : { background: "var(--tcy-bubble-in)", color: "var(--tcy-text)" }
                : undefined}
            >
              <FileAttachment
                m={m}
                own={own}
                onVideoOpen={onVideoOpen}
              />
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
                  background: own ? "var(--tcy-bubble-own-bg)" : "var(--tcy-bubble-in)",
                  color: own ? "var(--tcy-bubble-own-fg)" : "var(--tcy-text)",
                }}
              >
                <p className="tcy-msg-body text-[15px] leading-[1.5] whitespace-pre-wrap break-words">
                  <MessageText text={m.body} />
                </p>
                <LinkPreview text={m.body ?? ""} own={own} enabled />
                <MessageMeta
                  m={m}
                  own={own}
                  isChannel={isChannel}
                  peerLastReadId={peerLastReadId}
                  isImage={isImage}
                  isStickerMessage={isStickerMessage}
                  inCaptionFrame
                />
              </div>
            ) : (
              <>
                <p className="tcy-msg-body text-[15px] leading-[1.5] whitespace-pre-wrap break-words">
                  <MessageText text={m.body} />
                </p>
                <LinkPreview text={m.body ?? ""} own={own} enabled />
              </>
            )
          )}

          {!hasMediaCaption && (
            <MessageMeta
              m={m}
              own={own}
              isChannel={isChannel}
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

        {isChannel && showChannelComments && reactions.length > 0 && <div className="h-4" />}
        {isChannel && showChannelComments && (
          <div className="flex h-fit self-stretch shrink-0 items-center border-t tcy-line px-2 py-1">
            <button
              type="button"
              onClick={onOpenChannelComments}
              aria-label={`Открыть комментарии, комментариев ${channelCommentsCount}`}
              className="tcy-press flex w-full min-w-0 items-center gap-2 rounded-[13px] px-2.5 py-2 text-left text-[12.5px] font-bold tcy-accent"
            >
              <MessageCircle size={16} className="shrink-0" />
              <span className="flex-1">Комментарии</span>
              {channelCommentsCount > 0 && (
                <span className="min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10.5px] tcy-card-strong">
                  {channelCommentsCount}
                </span>
              )}
            </button>
          </div>
        )}
        {reactions.length > 0 && !(isChannel && showChannelComments) && <div className="h-4" />}
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
