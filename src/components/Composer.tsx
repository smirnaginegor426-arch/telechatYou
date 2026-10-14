import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, FileUp, Image as ImageIcon, Images, Mic, Plus, SendHorizonal, Smile, Trash2, X } from "lucide-react";
import { EmojiPicker } from "./EmojiPicker";
import { formatDuration } from "@/lib/format";
import { compressPhoto, getMediaSendPreferences } from "@/lib/media-send-preferences";
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
};

export function Composer({
  onSendText,
  onSendVoice,
  onAttachImage,
  onAttachFile,
  sending,
  enterToSend,
}: Props) {
  const [text, setText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [preparingImage, setPreparingImage] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [cancelHint, setCancelHint] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const cancelRef = useRef(false);
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
    } catch {
      alert("Нет доступа к микрофону. Разрешите доступ в настройках браузера.");
    }
  };

  const recSecondsRef = useRef(0);

  useEffect(() => () => stopRecording(false), [stopRecording]);

  // auto-grow textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [text]);

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
    setEmojiOpen(false);
    setAttachOpen(false);
  };

  const onMicDown = (e: React.PointerEvent) => {
    if (text.trim()) return;
    e.preventDefault();
    startPosRef.current = { x: e.clientX, y: e.clientY };
    void startRecording();
  };
  const onMicMove = (e: React.PointerEvent) => {
    if (!recording || !startPosRef.current) return;
    const dx = startPosRef.current.x - e.clientX;
    if (dx > 90) setCancelHint(true);
    if (dx > 140) {
      startPosRef.current = null;
      stopRecording(false);
    }
  };
  const onMicUp = () => {
    if (!recording) return;
    startPosRef.current = null;
    stopRecording(true);
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
            "flex items-end gap-2 rounded-[26px] border tcy-line tcy-header-blur px-2 py-2 tcy-shadow-soft transition-colors",
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
                  setEmojiOpen(false);
                }}
                className={cn(
                  "tcy-press w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-transform",
                  attachOpen && "rotate-45",
                )}
                style={{ background: "var(--tcy-card-strong)", color: "var(--tcy-dim)" }}
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
                onFocus={() => setEmojiOpen(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && enterToSend) {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder="Сообщение…"
                className="tcy-composer-input flex-1 bg-transparent outline-none resize-none text-[15px] tcy-text placeholder:text-[color:var(--tcy-faint)] py-2.5 max-h-[120px] no-scrollbar leading-[1.4]"
              />
              <button
                onClick={() => setEmojiOpen((v) => !v)}
                className="tcy-press w-10 h-11 flex items-center justify-center shrink-0"
                style={{ color: emojiOpen ? "var(--tcy-accent)" : "var(--tcy-faint)" }}
                aria-label="Эмодзи"
              >
                <Smile size={22} />
              </button>
              {hasContent ? (
                <motion.button
                  key="send"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 26 }}
                  onClick={submit}
                  disabled={sending}
                  className="tcy-press w-11 h-11 rounded-full tcy-gradient-accent tcy-shadow-accent flex items-center justify-center shrink-0"
                  style={{ color: "var(--tcy-on-accent)" }}
                  aria-label="Отправить"
                >
                  <SendHorizonal size={19} className="-ml-0.5" />
                </motion.button>
              ) : (
                <motion.button
                  key="mic"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 26 }}
                  onPointerDown={onMicDown}
                  onPointerMove={onMicMove}
                  onPointerUp={onMicUp}
                  onPointerCancel={() => recording && stopRecording(false)}
                  onContextMenu={(e) => e.preventDefault()}
                  className="tcy-press w-11 h-11 rounded-full flex items-center justify-center shrink-0 touch-none"
                  style={{
                    background: recording ? "var(--tcy-danger)" : "var(--tcy-card-strong)",
                    color: recording ? "#fff" : "var(--tcy-dim)",
                  }}
                  aria-label="Удерживайте для голосового"
                >
                  {recording ? <Trash2 size={19} /> : <Mic size={20} />}
                </motion.button>
              )}
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {emojiOpen && !recording && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 38 }}
            className="overflow-hidden border-t tcy-line tcy-header-blur"
          >
            <EmojiPicker
              onPick={(e) => {
                setText((t) => t + e);
                inputRef.current?.focus();
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
