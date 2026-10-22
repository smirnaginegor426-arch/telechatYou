import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Brush, ClipboardPaste, Copy, FileText, FileUp, Images, Mic, Plus, Scissors, Trash2, X } from "lucide-react";
import { StickerPicker } from "./StickerPicker";
import type { StickerAsset, StickerPack } from "@/lib/stickers";
import { formatDuration } from "@/lib/format";
import { compressPhoto, getMediaSendPreferences, MEDIA_SEND_PREFERENCES_CHANGED_EVENT } from "@/lib/media-send-preferences";
import { cn } from "@/lib/utils";
import { PhotoEditor } from "./PhotoEditor";


type PendingAttachment = { id: string; file: File; kind: "image" | "file" };

function isImageAttachment(file: File) {
  const type = file.type.toLowerCase();
  if (type.startsWith("video/") || /\.(3gp|avi|flv|m4v|mkv|mov|mp4|mpeg|mpg|ogv|ts|webm)$/i.test(file.name)) {
    return false;
  }
  return type.startsWith("image/") ||
    /\.(avif|bmp|gif|heic|heif|jpe?g|png|tiff?|webp)$/i.test(file.name);
}


function PendingAttachmentTile({
  attachment,
  onRemove,
  onEdit,
  onPreview,
}: {
  attachment: PendingAttachment;
  onRemove: () => void;
  onEdit: (attachment: PendingAttachment) => void;
  onPreview: (file: File, name: string) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (attachment.kind !== "image") {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(attachment.file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [attachment.file, attachment.kind]);

  if (attachment.kind === "image") {
    return (
      <div className="relative h-[124px] w-[98px] shrink-0 overflow-hidden rounded-[17px] border border-white/15 bg-black/15 shadow-[0_5px_18px_rgba(0,0,0,0.12)]">
        <button
          type="button"
          onClick={() => onPreview(attachment.file, attachment.file.name)}
          className="absolute inset-0 block h-full w-full"
          aria-label={`Открыть фото ${attachment.file.name}`}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={attachment.file.name || "Фото"}
              className="h-full w-full object-cover"
              loading="eager"
              decoding="async"
            />
          ) : (
            <span className="tcy-skeleton block h-full w-full" />
          )}
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/55 to-transparent" />
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onEdit(attachment);
          }}
          aria-label="Редактировать фото"
          title="Редактировать фото"
          className="tcy-press absolute right-1.5 top-1.5 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-black/45 text-white shadow-[0_4px_18px_rgba(0,0,0,0.35)] backdrop-blur-2xl transition-transform hover:scale-105 active:scale-95"
        >
          <Brush size={19} strokeWidth={2.3} />
        </button>
        <span className="pointer-events-none absolute bottom-2 left-2 max-w-[56px] truncate text-[10px] font-bold text-white/90 drop-shadow">
          Фото
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Удалить фото ${attachment.file.name}`}
          className="tcy-press absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white shadow-lg backdrop-blur-md"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex max-w-[245px] shrink-0 items-center gap-2 rounded-[14px] border tcy-line tcy-card px-2.5 py-2">
      <FileText size={16} className="tcy-accent shrink-0" />
      <span className="max-w-[155px] truncate text-[11.5px] tcy-text">{attachment.file.name}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Удалить вложение ${attachment.file.name}`}
        className="tcy-press flex h-6 w-6 shrink-0 items-center justify-center rounded-full tcy-faint"
      >
        <X size={13} />
      </button>

    </div>
  );
}

function PhotoPreviewOverlay({ file, onClose }: { file: File; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[10050] flex flex-col bg-black/95 text-white"
      onClick={onClose}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 safe-top" onClick={(event) => event.stopPropagation()}>
        <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{file.name || "Фото"}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть фото"
          className="tcy-press flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-xl"
        >
          <X size={19} />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-3 pb-5" onClick={(event) => event.stopPropagation()}>
        {url ? (
          <img
            src={url}
            alt={file.name || "Фото"}
            className="max-h-full max-w-full rounded-[18px] object-contain shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
          />
        ) : (
          <span className="tcy-skeleton h-[200px] w-[200px] rounded-[18px]" />
        )}
      </div>
    </motion.div>
  );
}

type Props = {
  onSendText: (text: string) => void;
  onSendVoice: (blob: Blob, duration: number) => void;
  onAttachImage: (file: File, caption?: string) => void;
  onAttachFile: (file: File, caption?: string) => void;
  sending?: boolean;
  enterToSend?: boolean;
  onSendSticker?: (sticker: StickerAsset, packName: string, pack?: StickerPack) => void;
};

export function Composer({
  onSendText,
  onSendVoice,
  onAttachImage,
  onAttachFile,
  sending,
  enterToSend,
  onSendSticker,
}: Props) {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [stickersEnabled, setStickersEnabled] = useState(() => getMediaSendPreferences().stickersEnabled);
  const [stickerOpen, setStickerOpen] = useState(() => {
    try {
      const shouldOpen = sessionStorage.getItem("tcy-open-stickers-after-create") === "1";
      sessionStorage.removeItem("tcy-open-stickers-after-create");
      return shouldOpen;
    } catch {
      return false;
    }
  });
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachPosition, setAttachPosition] = useState<{ left: number; bottom: number } | null>(null);
  const [preparingImage, setPreparingImage] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [editingAttachment, setEditingAttachment] = useState<PendingAttachment | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<File | null>(null);
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [cancelHint, setCancelHint] = useState(false);
  const [textMenu, setTextMenu] = useState<{ x: number; y: number; start: number; end: number } | null>(null);

  useEffect(() => {
    const refreshStickerPreference = () => {
      const enabled = getMediaSendPreferences().stickersEnabled;
      setStickersEnabled(enabled);
      if (!enabled) setStickerOpen(false);
    };
    window.addEventListener(MEDIA_SEND_PREFERENCES_CHANGED_EVENT, refreshStickerPreference);
    window.addEventListener("storage", refreshStickerPreference);
    return () => {
      window.removeEventListener(MEDIA_SEND_PREFERENCES_CHANGED_EVENT, refreshStickerPreference);
      window.removeEventListener("storage", refreshStickerPreference);
    };
  }, []);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentButtonRef = useRef<HTMLButtonElement>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const cancelRef = useRef(false);
  const pressActiveRef = useRef(false);
  const pendingSendRef = useRef<boolean | null>(null);
  const gestureCleanupRef = useRef<(() => void) | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [levels, setLevels] = useState<number[]>([]);
  const rafRef = useRef<number>(0);

  const stopVisualizer = () => {
    cancelAnimationFrame(rafRef.current);
    analyserRef.current = null;
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLevels([]);
  };

  const stopRecording = useCallback(
    (send: boolean) => {
      cancelRef.current = !send;
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
      const rec = mediaRef.current;
      mediaRef.current = null;
      if (rec && rec.state !== "inactive") rec.stop();
      else {
        setRecording(false);
        stopVisualizer();
      }
    },
    [],
  );

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      mediaRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        const duration = recSecondsRef.current;
        if (!cancelRef.current && blob.size > 0 && duration >= 0.5) {
          onSendVoice(blob, duration);
        }
        setRecording(false);
        stopVisualizer();
      };
      // visualizer
      try {
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        src.connect(analyser);
        analyserRef.current = analyser;
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(data);
          const bars: number[] = [];
          const step = Math.floor(data.length / 18);
          for (let i = 0; i < 18; i++) bars.push((data[i * step] ?? 0) / 255);
          setLevels(bars);
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        /* visualizer is optional */
      }
      rec.start(200);
      setRecSeconds(0);
      recSecondsRef.current = 0;
      setRecording(true);
      setCancelHint(false);
      timerRef.current = window.setInterval(() => {
        recSecondsRef.current += 0.1;
        setRecSeconds((s) => s + 0.1);
      }, 100);
      // The user may release the button before the microphone permission is
      // granted. If the gesture already ended, finish it now instead of
      // leaving the recorder running forever.
      if (pendingSendRef.current !== null) {
        const send = pendingSendRef.current;
        pendingSendRef.current = null;
        stopRecording(send);
      }
    } catch {
      // Reset the whole gesture so a denied permission cannot leave the
      // composer stuck or cut off the next recording.
      pressActiveRef.current = false;
      pendingSendRef.current = null;
      startPosRef.current = null;
      gestureCleanupRef.current?.();
      gestureCleanupRef.current = null;
      setCancelHint(false);
      alert("Нет доступа к микрофону. Разрешите доступ в настройках браузера.");
    }
  };

  const recSecondsRef = useRef(0);

  const endMicGesture = useCallback(
    (send: boolean) => {
      if (!pressActiveRef.current) return;
      pressActiveRef.current = false;
      startPosRef.current = null;
      setCancelHint(false);
      gestureCleanupRef.current?.();
      gestureCleanupRef.current = null;
      // getUserMedia may still be resolving; remember the outcome and finish
      // the gesture as soon as the recorder is ready.
      if (!mediaRef.current) {
        pendingSendRef.current = send;
        return;
      }
      stopRecording(send);
    },
    [stopRecording],
  );

  useEffect(
    () => () => {
      gestureCleanupRef.current?.();
      gestureCleanupRef.current = null;
      stopRecording(false);
    },
    [stopRecording],
  );

  // auto-grow textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [text]);

  useEffect(() => {
    if (!textMenu) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest("[data-tcy-text-menu]")) return;
      setTextMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTextMenu(null);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [textMenu]);

  const openTextMenu = (event: React.MouseEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    const textarea = event.currentTarget;
    const value = textarea.value;
    let start = textarea.selectionStart;
    let end = textarea.selectionEnd;
    if (start === end && value.length > 0) {
      let left = start;
      let right = end;
      while (left > 0 && /[A-Za-zА-Яа-яЁё0-9_]/.test(value[left - 1])) left--;
      while (right < value.length && /[A-Za-zА-Яа-яЁё0-9_]/.test(value[right])) right++;
      if (left < right) {
        start = left;
        end = right;
        textarea.setSelectionRange(start, end);
      }
    }
    setTextMenu({
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - 196)),
      y: Math.max(8, Math.min(event.clientY + 8, window.innerHeight - 154)),
      start,
      end,
    });
  };

  const copyTextSelection = async () => {
    if (!textMenu || textMenu.end <= textMenu.start) return;
    try {
      await navigator.clipboard.writeText(text.slice(textMenu.start, textMenu.end));
    } catch {
      alert("Не удалось скопировать текст. Проверь доступ к буферу обмена браузера.");
    }
    setTextMenu(null);
  };

  const cutTextSelection = async () => {
    if (!textMenu || textMenu.end <= textMenu.start) return;
    try {
      await navigator.clipboard.writeText(text.slice(textMenu.start, textMenu.end));
      const next = text.slice(0, textMenu.start) + text.slice(textMenu.end);
      setText(next);
      const caret = textMenu.start;
      setTextMenu(null);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(caret, caret);
      });
    } catch {
      alert("Не удалось вырезать текст. Проверь доступ к буферу обмена браузера.");
    }
  };

  const pasteTextSelection = async () => {
    if (!textMenu) return;
    try {
      const clipboardText = await navigator.clipboard.readText();
      const next = text.slice(0, textMenu.start) + clipboardText + text.slice(textMenu.end);
      const caret = textMenu.start + clipboardText.length;
      setText(next);
      setTextMenu(null);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(caret, caret);
      });
    } catch {
      setTextMenu(null);
      alert("Браузер не разрешил вставить текст автоматически. Используй стандартную команду вставки.");
    }
  };

  const submit = () => {
    const t = text.trim();
    if (!t && pendingAttachments.length === 0) return;

    const preferences = getMediaSendPreferences();
    if (
      pendingAttachments.length > 0 &&
      preferences.confirmBeforeSend &&
      !window.confirm(`Отправить вложения (${pendingAttachments.length} шт.)?`)
    ) {
      return;
    }

    if (pendingAttachments.length === 0) {
      if (t) onSendText(t);
    } else {
      // Put the caption on the first attachment message so text and media
      // appear together instead of as two separate chat messages.
      pendingAttachments.forEach((attachment, index) => {
        const caption = index === 0 ? (t || undefined) : undefined;
        if (attachment.kind === "image") onAttachImage(attachment.file, caption);
        else onAttachFile(attachment.file, caption);
      });
    }

    setPendingAttachments([]);
    setText("");
    setStickerOpen(false);
    setAttachOpen(false);
  };

  const onMicDown = (e: React.PointerEvent) => {
    if (text.trim()) return;
    if (pressActiveRef.current) return;
    e.preventDefault();
    pressActiveRef.current = true;
    startPosRef.current = { x: e.clientX, y: e.clientY };
    setCancelHint(false);

    // While recording, the mic button is replaced by the recording indicator,
    // so pointer events on the button never fire. Listen on the window instead
    // for the whole press gesture so releasing sends and swiping left cancels.
    const onWindowPointerMove = (event: PointerEvent) => {
      if (!startPosRef.current) return;
      const dx = startPosRef.current.x - event.clientX;
      if (dx > 90) setCancelHint(true);
      if (dx > 140) endMicGesture(false);
    };
    const onWindowPointerUp = () => endMicGesture(true);
    const onWindowPointerCancel = () => endMicGesture(false);

    gestureCleanupRef.current = () => {
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerup", onWindowPointerUp);
      window.removeEventListener("pointercancel", onWindowPointerCancel);
    };
    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerup", onWindowPointerUp);
    window.addEventListener("pointercancel", onWindowPointerCancel);

    void startRecording();
  };

  const toggleAttachmentMenu = () => {
    if (attachOpen) {
      setAttachOpen(false);
      return;
    }
    const rect = attachmentButtonRef.current?.getBoundingClientRect();
    const menuWidth = 224;
    setAttachPosition(
      rect
        ? {
            left: Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8)),
            bottom: Math.max(12, window.innerHeight - rect.top + 8),
          }
        : { left: 12, bottom: 120 },
    );
    setAttachOpen(true);
    setStickerOpen(false);
  };

  const hasText = text.trim().length > 0;
  const hasContent = hasText || pendingAttachments.length > 0;

  const handleImageSelection = async (files: File[]) => {
    setAttachOpen(false);
    if (files.length === 0) return;
    const preferences = getMediaSendPreferences();

    setPreparingImage(true);
    try {
      const preparedFiles: PendingAttachment[] = [];
      for (const file of files) {
        const isVideo = file.type.toLowerCase().startsWith("video/") ||
          /\.(3gp|avi|flv|m4v|mkv|mov|mp4|mpeg|mpg|ogv|ts|webm)$/i.test(file.name);
        let prepared = file;
        if (!isVideo && preferences.compressPhotos) {
          try {
            prepared = await compressPhoto(file);
          } catch {
            // If the browser cannot decode/compress this image, still attach the original.
            prepared = file;
          }
        }
        preparedFiles.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${preparedFiles.length}`,
          file: prepared,
          kind: isVideo ? "file" : "image",
        });
      }
      setPendingAttachments((current) => [...current, ...preparedFiles]);
    } finally {
      setPreparingImage(false);
    }
  };

  const handleFileSelection = (files: File[]) => {
    setAttachOpen(false);
    if (files.length === 0) return;
    const queued = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name}`,
      file,
      // Images selected via "Загрузить файл" should be rendered as photos too.
      kind: isImageAttachment(file) ? "image" as const : "file" as const,
    }));
    setPendingAttachments((current) => [...current, ...queued]);
  };

  return (
    <div className="relative z-20 shrink-0">
      <input
        ref={imgInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void handleImageSelection(files);
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          handleFileSelection(files);
        }}
      />

      {attachOpen && typeof document !== "undefined" && createPortal(
        <div
          role="menu"
          aria-label="Добавить вложение"
          className="fixed z-[2147483647] w-[216px] rounded-[16px] border p-1.5"
          style={{
            left: attachPosition?.left ?? 12,
            bottom: attachPosition?.bottom ?? 120,
            background: "var(--tcy-solid)",
            borderColor: "var(--tcy-line)",
            boxShadow: "0 14px 40px rgba(0,0,0,0.42)",
            pointerEvents: "auto",
          }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => { setAttachOpen(false); fileInputRef.current?.click(); }}
            className="tcy-press flex h-10 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[13px] font-medium"
            style={{ color: "var(--tcy-text)" }}
          >
            <FileUp size={16} strokeWidth={1.8} className="shrink-0" />
            <span>Загрузить файл</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => { setAttachOpen(false); imgInputRef.current?.click(); }}
            className="tcy-press flex h-10 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[13px] font-medium"
            style={{ color: "var(--tcy-text)" }}
          >
            <Images size={16} strokeWidth={1.8} className="shrink-0" />
            <span>Галерея</span>
          </button>
        </div>,
        document.body,
      )}

      <AnimatePresence>
        {stickerOpen && !recording && (
          <StickerPicker
            onSelect={(sticker, packName, pack) => onSendSticker?.(sticker, packName, pack)}
            onCreatePack={() => {
              try { sessionStorage.setItem("tcy-open-stickers-after-create", "1"); } catch { /* session state is optional */ }
              setStickerOpen(false);
              navigate("/stickers/new");
            }}
            onClose={() => setStickerOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className="px-3 pb-3 pt-1.5 safe-bottom" hidden={stickerOpen}>
        {pendingAttachments.length > 0 && !recording && (
          <div className="flex flex-nowrap items-center gap-2.5 overflow-x-auto no-scrollbar px-1 pb-2">
            {pendingAttachments.map((attachment) => (
              <PendingAttachmentTile
                key={attachment.id}
                attachment={attachment}
                onRemove={() => setPendingAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                onEdit={(item) => {
                  setPreviewPhoto(null);
                  setEditingAttachment(item);
                }}
                onPreview={(file) => setPreviewPhoto(file)}
              />
            ))}
          </div>
        )}
        <div
          className={cn(
            "flex items-end gap-2 rounded-[26px] tcy-glass-surface px-2 py-2 tcy-shadow-soft transition-colors",
            recording && "border-[color:var(--tcy-danger)]",
          )}
        >
          {recording ? (
            <div className="flex-1 flex items-center gap-3 h-11 px-2 overflow-hidden">
              <span className="w-2.5 h-2.5 rounded-full tcy-rec-dot shrink-0" style={{ background: "var(--tcy-danger)" }} />
              <span className="text-[14px] font-bold tabular-nums tcy-text shrink-0">
                {formatDuration(recSeconds)}
              </span>
              <div className="flex-1 flex items-center gap-[2.5px] h-7 overflow-hidden">
                {(levels.length ? levels : [0.2, 0.4, 0.3]).map((v, i) => (
                  <span
                    key={i}
                    className="flex-1 max-w-[4px] rounded-full"
                    style={{
                      height: `${Math.max(12, v * 100)}%`,
                      background: "var(--tcy-danger)",
                      opacity: 0.85,
                      transition: "height 0.08s",
                    }}
                  />
                ))}
              </div>
              <span className={cn("text-[12px] font-semibold shrink-0 transition-colors", cancelHint ? "tcy-danger" : "tcy-faint")}>
                ← отмена
              </span>
            </div>
          ) : (
            <>
              <div className="relative shrink-0">

                <button
                  ref={attachmentButtonRef}
                  onClick={toggleAttachmentMenu}
                  className={cn(
                    "tcy-press tcy-glass-surface flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform",
                    attachOpen && "rotate-45",
                  )}
                  style={{ color: "var(--tcy-dim)" }}
                  disabled={preparingImage}
                  aria-label="Прикрепить"
                >
                  <Plus size={21} />
                </button>
              </div>
              <textarea
                ref={inputRef}
                value={text}
                rows={1}
                onChange={(e) => setText(e.target.value)}
                onContextMenu={openTextMenu}
                onFocus={() => setStickerOpen(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && enterToSend) {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder="Сообщение…"
                className="tcy-composer-input flex-1 bg-transparent outline-none resize-none text-[15px] tcy-text placeholder:text-[color:var(--tcy-faint)] py-2.5 max-h-[120px] no-scrollbar leading-[1.4]"
              />
              {stickersEnabled && (
              <button
                onClick={() => setStickerOpen((value) => !value)}
                className="tcy-press tcy-glass-surface flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ color: stickerOpen ? "var(--tcy-selected-accent)" : "var(--tcy-faint)" }}
                aria-label="Стикеры"
                aria-expanded={stickerOpen}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    d="M7.2 1.7H16.7C19.4 1.7 21.4 3.7 21.4 6.3V14.1L11.7 22.2H7.2C4.6 22.2 2.6 20.3 2.6 17.8C2.6 16.7 4.9 15.9 4.9 14.4C4.9 12.8 2.6 12 2.6 10.5C2.6 9 4.9 8.2 4.9 6.6C4.9 5 2.6 4.4 2.6 3.8C2.6 2.6 4.5 1.7 7.2 1.7Z"
                    fill="currentColor"
                  />
                  <path
                    d="M21.4 14.1H16.6C13.8 14.1 11.7 16.3 11.7 19.1V22.2L21.4 14.1Z"
                    fill="currentColor"
                    opacity="0.48"
                  />
                </svg>
              </button>
              )}
              <div className="relative w-11 h-11 shrink-0">
                <AnimatePresence initial={false} mode="sync">
                  {hasContent ? (
                    <motion.button
                      key="send"
                      initial={{ scale: 0.35, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.12, opacity: 0, transition: { duration: 0.12, ease: "easeIn" } }}
                      transition={{ type: "spring", stiffness: 720, damping: 30, mass: 0.62 }}
                      onClick={submit}
                      disabled={sending}
                      className="tcy-press absolute inset-0 rounded-full tcy-gradient-accent tcy-shadow-accent flex items-center justify-center"
                      style={{ color: "var(--tcy-on-accent)" }}
                      aria-label="Отправить"
                    >
                      <ArrowUp size={23} strokeWidth={2.4} />
                    </motion.button>
                  ) : (
                    <motion.button
                      key="mic"
                      initial={{ scale: 0.3, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.12, opacity: 0, transition: { duration: 0.12, ease: "easeIn" } }}
                      transition={{ type: "spring", stiffness: 720, damping: 30, mass: 0.62 }}
                      onPointerDown={onMicDown}
                      onContextMenu={(e) => e.preventDefault()}
                      className="tcy-press tcy-glass-surface absolute inset-0 flex items-center justify-center rounded-full touch-none select-none"
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: recording ? "var(--tcy-danger)" : undefined,
                        color: recording ? "#fff" : "var(--tcy-dim)",
                      }}
                      aria-label="Удерживайте для голосового"
                    >
                      {recording ? <Trash2 size={19} /> : <Mic size={20} />}
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>
      </div>

      {textMenu && createPortal(
        <div
          data-tcy-text-menu
          onPointerDown={(event) => event.preventDefault()}
          className="fixed z-[10000] flex min-w-[176px] flex-col overflow-hidden rounded-[15px] border tcy-line tcy-solid shadow-xl"
          style={{ left: textMenu.x, top: textMenu.y, boxShadow: "0 12px 36px rgba(0,0,0,0.25)" }}
          role="menu"
          aria-label="Действия с выделенным текстом"
        >
          <button
            type="button"
            role="menuitem"
            disabled={textMenu.end <= textMenu.start}
            onClick={() => void copyTextSelection()}
            className="flex items-center gap-3 px-3.5 py-3 text-left text-[13px] font-semibold tcy-text disabled:opacity-40"
          >
            <Copy size={16} className="tcy-dim" /> Копировать
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={textMenu.end <= textMenu.start}
            onClick={() => void cutTextSelection()}
            className="flex items-center gap-3 border-t tcy-line px-3.5 py-3 text-left text-[13px] font-semibold tcy-text disabled:opacity-40"
          >
            <Scissors size={16} className="tcy-dim" /> Вырезать
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => void pasteTextSelection()}
            className="flex items-center gap-3 border-t tcy-line px-3.5 py-3 text-left text-[13px] font-semibold tcy-text"
          >
            <ClipboardPaste size={16} className="tcy-dim" /> Вставить
          </button>
        </div>,
        document.body,
      )}
      {editingAttachment?.kind === "image" && createPortal(
        <div className="fixed inset-0 z-[10060]">
          <PhotoEditor
            key={editingAttachment.id}
            image={editingAttachment.file}
            onCancel={() => setEditingAttachment(null)}
            onSave={(editedFile) => {
              setPendingAttachments((current) => current.map((item) =>
                item.id === editingAttachment.id ? { ...item, file: editedFile } : item
              ));
              setEditingAttachment(null);
            }}
          />
        </div>,
        document.body,
      )}

      {previewPhoto && createPortal(
        <PhotoPreviewOverlay file={previewPhoto} onClose={() => setPreviewPhoto(null)} />,
        document.body,
      )}
    </div>
  );
}
