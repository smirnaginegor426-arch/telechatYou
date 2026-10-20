import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Mic, Plus, SendHorizonal, Smile, Trash2 } from "lucide-react";
import { EmojiPicker } from "./EmojiPicker";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  onSendText: (text: string) => void;
  onSendVoice: (blob: Blob, duration: number) => void;
  onAttachImage: (file: File) => void;
  onAttachFile: (file: File) => void;
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
  const [attachPosition, setAttachPosition] = useState<{ left: number; bottom: number } | null>(null);
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [cancelHint, setCancelHint] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentButtonRef = useRef<HTMLButtonElement>(null);
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
    if (!t) return;
    onSendText(t);
    setText("");
    setEmojiOpen(false);
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
    setEmojiOpen(false);
  };

  const hasText = text.trim().length > 0;

  return (
    <div className="relative z-20 shrink-0">
      <input
        ref={imgInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onAttachImage(f);
          e.target.value = "";
          setAttachOpen(false);
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onAttachFile(f);
          e.target.value = "";
          setAttachOpen(false);
        }}
      />

      {attachOpen && typeof document !== "undefined" && createPortal(
        <div
          role="menu"
          aria-label="Добавить вложение"
          className="fixed z-[2147483647] min-w-[190px] rounded-[18px] border p-2"
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
            onClick={() => { setAttachOpen(false); imgInputRef.current?.click(); }}
            className="tcy-press flex w-full items-center gap-3 rounded-[13px] px-3.5 py-3 text-left"
            style={{ color: "var(--tcy-text)" }}
          >
            <span className="text-[20px]">🖼️</span>
            <span className="text-[14px] font-semibold">Фотография</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => { setAttachOpen(false); fileInputRef.current?.click(); }}
            className="tcy-press flex w-full items-center gap-3 rounded-[13px] px-3.5 py-3 text-left"
            style={{ color: "var(--tcy-text)" }}
          >
            <span className="text-[20px]">📎</span>
            <span className="text-[14px] font-semibold">Файл</span>
          </button>
        </div>,
        document.body,
      )}

      <div className="px-3 pb-3 pt-1.5 safe-bottom">
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
              <div className="relative shrink-0">

                <button
                  ref={attachmentButtonRef}
                  onClick={toggleAttachmentMenu}
                  className={cn(
                    "tcy-press w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-transform",
                    attachOpen && "rotate-45",
                  )}
                  style={{ background: "var(--tcy-card-strong)", color: "var(--tcy-dim)" }}
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
                onFocus={() => setEmojiOpen(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && enterToSend) {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder="Сообщение…"
                className="flex-1 bg-transparent outline-none resize-none text-[15px] tcy-text placeholder:text-[color:var(--tcy-faint)] py-2.5 max-h-[120px] no-scrollbar leading-[1.4]"
              />
              <button
                onClick={() => setEmojiOpen((v) => !v)}
                className="tcy-press w-10 h-11 flex items-center justify-center shrink-0"
                style={{ color: emojiOpen ? "var(--tcy-accent)" : "var(--tcy-faint)" }}
                aria-label="Эмодзи"
              >
                <Smile size={22} />
              </button>
              {hasText ? (
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
