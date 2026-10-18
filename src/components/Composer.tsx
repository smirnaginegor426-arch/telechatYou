import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, ClipboardPaste, Copy, FileText, FileUp, Image as ImageIcon, Images, Mic, Plus, Scissors, Sticker, Trash2, X } from "lucide-react";
import { StickerPicker } from "./StickerPicker";
import type { StickerAsset, StickerPack } from "@/lib/stickers";
import { formatDuration } from "@/lib/format";
import { compressPhoto, getMediaSendPreferences, MEDIA_SEND_PREFERENCES_CHANGED_EVENT } from "@/lib/media-send-preferences";
import { cn } from "@/lib/utils";


type PendingAttachment = { id: string; file: File; kind: "image" | "file" };

function isImageAttachment(file: File) {
  return file.type.toLowerCase().startsWith("image/") ||
    /\.(avif|bmp|gif|heic|heif|jpe?g|png|tiff?|webp)$/i.test(file.name);
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
  const [preparingImage, setPreparingImage] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
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
        const prepared = preferences.compressPhotos ? await compressPhoto(file) : file;
        preparedFiles.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file: prepared,
          kind: "image",
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
        accept="image/*"
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

      {/* compact attachment chooser */}
      <AnimatePresence>
        {attachOpen && (
          <motion.div
            role="menu"
            aria-label="Добавить вложение"
            initial={{ opacity: 0, y: 7, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 520, damping: 38 }}
            className="absolute bottom-[72px] left-3 z-30 w-[208px] rounded-[15px] border tcy-line tcy-solid p-1.5 shadow-xl"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => fileInputRef.current?.click()}
              className="tcy-press w-full h-9 flex items-center gap-2.5 rounded-[9px] px-2.5 text-left text-[13px] font-medium tcy-text hover:bg-[color:var(--tcy-card)]"
            >
              <FileUp size={16} strokeWidth={1.8} className="shrink-0 tcy-dim" />
              <span>Загрузить файл</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => imgInputRef.current?.click()}
              className="tcy-press w-full h-9 flex items-center gap-2.5 rounded-[9px] px-2.5 text-left text-[13px] font-medium tcy-text hover:bg-[color:var(--tcy-card)]"
            >
              <Images size={16} strokeWidth={1.8} className="shrink-0 tcy-dim" />
              <span>Галерея</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-3 pb-3 pt-1.5 safe-bottom">
        {pendingAttachments.length > 0 && !recording && (
          <div className="flex flex-wrap gap-2 px-1 pb-2">
            {pendingAttachments.map((attachment) => (
              <div
                key={attachment.id}
                className="max-w-full flex items-center gap-2 rounded-[14px] tcy-card border tcy-line px-2.5 py-2"
              >
                {attachment.kind === "image"
                  ? <ImageIcon size={16} className="tcy-accent shrink-0" />
                  : <FileText size={16} className="tcy-accent shrink-0" />}
                <span className="max-w-[160px] truncate text-[11.5px] tcy-text">
                  {attachment.file.name}
                </span>
                <button
                  type="button"
                  onClick={() => setPendingAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                  aria-label={`Удалить вложение ${attachment.file.name}`}
                  className="tcy-press w-5 h-5 rounded-full flex items-center justify-center tcy-faint shrink-0"
                >
                  <X size={13} />
                </button>
              </div>
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
              <button
                onClick={() => {
                  setAttachOpen((v) => !v);
                  setStickerOpen(false);
                }}
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
                <Sticker size={22} />
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

    </div>
  );
}
