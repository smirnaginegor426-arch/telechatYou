import { useEffect, useRef, useState } from "react";
import { Check, Download, Film, LoaderCircle, Music2, Pause, Play } from "lucide-react";
import { formatFileSize } from "@/lib/format";

function clock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const value = Math.floor(seconds);
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

const WAVEFORM = [
  0.22, 0.42, 0.65, 0.34, 0.52, 0.79, 0.48, 0.29, 0.57, 0.87,
  0.45, 0.32, 0.68, 0.94, 0.54, 0.38, 0.74, 0.46, 0.26, 0.61,
  0.83, 0.43, 0.31, 0.67, 0.91, 0.5, 0.37, 0.72, 0.44, 0.25,
];

export function DownloadableMediaPlayer({
  url,
  name,
  size,
  own,
  video = false,
  mime,
}: {
  url: string | null;
  name: string;
  size: number | null;
  own: boolean;
  video?: boolean;
  mime?: string | null;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  const main = own ? "var(--tcy-bubble-own-fg)" : "var(--tcy-text)";
  const muted = own ? "var(--tcy-bubble-own-muted)" : "var(--tcy-faint)";
  const ext = name.includes(".") ? name.split(".").pop()?.toUpperCase() : (mime?.split("/")[1]?.toUpperCase() ?? (video ? "VIDEO" : "AUDIO"));

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const downloadAndPrepare = async () => {
    if (!url || downloading) return;
    setDownloading(true);
    setDownloadError("");
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("download failed");
      const blob = await response.blob();
      if (blob.size === 0) throw new Error("empty file");

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = name || (video ? "video" : "audio");
      link.rel = "noopener";
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();

      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = objectUrl;
      setLocalUrl(objectUrl);
      setCurrent(0);
      setDuration(0);
      setPlaying(false);
    } catch {
      setDownloadError("Не удалось скачать файл. Проверь соединение и попробуй ещё раз.");
    } finally {
      setDownloading(false);
    }
  };

  const toggleAudio = async () => {
    const audio = audioRef.current;
    if (!audio || !localUrl) return;
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setPlaying(false);
        setDownloadError("Не удалось воспроизвести файл. Попробуй нажать «Слушать» ещё раз.");
      }
    } else {
      audio.pause();
    }
  };

  const isDownloaded = Boolean(localUrl);

  return (
    <div
      className="tcy-audio-card w-[min(290px,72vw)] rounded-[20px] p-3"
      style={{
        color: main,
        background: own
          ? "color-mix(in srgb, var(--tcy-bubble-own-fg) 10%, transparent)"
          : "color-mix(in srgb, var(--tcy-card-strong) 72%, transparent)",
        border: `1px solid ${own ? "color-mix(in srgb, var(--tcy-bubble-own-fg) 18%, transparent)" : "var(--tcy-line)"}`,
      }}
    >
      {video && !isDownloaded && (
        <div className="relative mb-3 h-[150px] overflow-hidden rounded-[15px] bg-black/20">
          {url && (
            <video
              src={url}
              muted
              playsInline
              preload="metadata"
              aria-hidden="true"
              tabIndex={-1}
              className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover blur-xl opacity-70"
              onLoadedData={(event) => {
                try { event.currentTarget.currentTime = Math.min(0.2, event.currentTarget.duration || 0.2); } catch { /* poster stays blurred */ }
              }}
            />
          )}
          <div className="absolute inset-0 bg-black/20" />
          <button
            type="button"
            onClick={() => void downloadAndPrepare()}
            disabled={!url || downloading}
            aria-label="Скачать и посмотреть видео"
            className="tcy-press absolute left-1/2 top-1/2 z-[1] flex h-[58px] w-[58px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/50 bg-black/45 text-white shadow-lg backdrop-blur-md disabled:opacity-60"
          >
            {downloading ? <LoaderCircle size={25} className="animate-spin" /> : <Download size={25} strokeWidth={2.5} />}
          </button>
          <span className="absolute bottom-2 left-2 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
            Скачать и посмотреть
          </span>
        </div>
      )}
      {!video && (
        <audio
          className="hidden"
          ref={audioRef}
          src={localUrl ?? undefined}
          preload={localUrl ? "metadata" : "none"}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
          onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
          onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => { setPlaying(false); setCurrent(0); }}
          onError={() => setPlaying(false)}
        />
      )}

      <div className="flex min-w-0 items-center gap-2.5">
        <button
          type="button"
          onClick={() => {
            if (!isDownloaded) void downloadAndPrepare();
            else if (!video) void toggleAudio();
          }}
          disabled={!url || downloading || (isDownloaded && video)}
          aria-label={!isDownloaded ? "Скачать медиафайл" : video ? "Видео скачано" : playing ? "Пауза" : "Слушать"}
          className="tcy-press flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-60"
          style={{
            background: own
              ? "color-mix(in srgb, var(--tcy-bubble-own-fg) 18%, transparent)"
              : "var(--tcy-accent)",
            color: own ? main : "var(--tcy-on-accent)",
          }}
        >
          {downloading
            ? <LoaderCircle size={17} className="animate-spin" />
            : !isDownloaded
              ? <Download size={17} />
              : video
                ? <Check size={17} strokeWidth={2.7} />
                : playing
                  ? <Pause size={16} fill="currentColor" />
                  : <Play size={16} fill="currentColor" className="ml-0.5" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-bold" title={name}>{name}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-bold" style={{ color: muted }}>
            {video ? <Film size={12} /> : <Music2 size={12} />}
            <span>{ext}</span><span>·</span><span>{formatFileSize(size)}</span>
          </div>
        </div>
        <div className="shrink-0 text-right text-[10px] font-semibold" style={{ color: muted }}>
          {downloading ? "Скачивание…" : isDownloaded ? "Скачано" : "Скачать"}
        </div>
      </div>

      {video && isDownloaded && localUrl && (
        <video
          src={localUrl}
          controls
          playsInline
          preload="metadata"
          className="mt-3 max-h-[220px] w-full rounded-[13px] bg-black object-contain"
          onError={() => setDownloadError("Не удалось открыть видео в этом браузере. Попробуй открыть скачанный файл на устройстве.")}
        />
      )}

      {!video && isDownloaded && (
        <div className="mt-3 flex items-center gap-2.5">
          <div className="flex h-8 flex-1 items-center gap-[2.5px] overflow-hidden">
            {WAVEFORM.map((height, index) => (
              <span
                key={index}
                className="min-w-[2px] flex-1 rounded-full"
                style={{
                  height: `${Math.max(4, height * 28)}px`,
                  background: duration > 0 && index / WAVEFORM.length <= current / duration
                    ? main
                    : muted,
                  opacity: duration > 0 && index / WAVEFORM.length <= current / duration ? 0.95 : 0.65,
                }}
              />
            ))}
          </div>
          <span className="min-w-[54px] text-right text-[10px] font-semibold tabular-nums" style={{ color: muted }}>
            {clock(current)} / {clock(duration)}
          </span>
        </div>
      )}

      {!video && isDownloaded && (
        <div className="mt-1.5">
          <input
            aria-label="Позиция воспроизведения"
            className="tcy-audio-range w-full"
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={Math.min(current, duration || 1)}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (audioRef.current) audioRef.current.currentTime = next;
              setCurrent(next);
            }}
            style={{ accentColor: "var(--tcy-accent)" }}
          />
        </div>
      )}

      {!isDownloaded && (
        <p className="mt-2 px-1 text-[10.5px] leading-relaxed" style={{ color: muted }}>
          {video ? "Сначала скачай видео, затем его можно будет посмотреть." : "Сначала скачай аудио, затем его можно будет слушать."}
        </p>
      )}

      {downloadError && (
        <p role="status" className="mt-2 px-1 text-[10.5px] leading-relaxed" style={{ color: "var(--tcy-danger)" }}>
          {downloadError}
        </p>
      )}
    </div>
  );
}
