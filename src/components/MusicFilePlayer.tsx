import { useEffect, useRef, useState } from "react";
import { Disc3, LoaderCircle, Pause, Play } from "lucide-react";

function clock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const value = Math.floor(seconds);
  const mins = Math.floor(value / 60);
  const secs = value % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function mediaFormat(name: string, mime?: string | null) {
  const extension = name.includes(".") ? name.split(".").pop() : "";
  return (extension || mime?.split("/")[1] || "AUDIO").toUpperCase();
}

/** A voice-message-style music attachment without decorative waveform bars. */
export function MusicFilePlayer({
  url,
  name,
  mime,
  own,
}: {
  url: string | null;
  name: string;
  mime?: string | null;
  own: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(Boolean(url));
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);
  const format = mediaFormat(name, mime);
  const foreground = own ? "var(--tcy-bubble-own-fg)" : "var(--tcy-text)";
  const muted = own ? "var(--tcy-bubble-own-muted)" : "var(--tcy-faint)";

  useEffect(() => {
    const audio = audioRef.current;
    setLoading(Boolean(url));
    setFailed(false);
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.load();
    }
    return () => audio?.pause();
  }, [url]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio || !url || failed) return;
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setPlaying(false);
        setFailed(true);
      }
    } else {
      audio.pause();
    }
  };

  return (
    <div
      className="w-[min(300px,74vw)] rounded-[18px] border px-3 py-2.5"
      style={{
        background: own
          ? "color-mix(in srgb, var(--tcy-bubble-own-bg) 92%, transparent)"
          : "color-mix(in srgb, var(--tcy-card-strong) 82%, transparent)",
        borderColor: own
          ? "color-mix(in srgb, var(--tcy-bubble-own-fg) 17%, transparent)"
          : "var(--tcy-line)",
        color: foreground,
      }}
    >
      <audio
        ref={audioRef}
        src={url ?? undefined}
        preload="metadata"
        className="hidden"
        onLoadStart={() => { setLoading(true); setFailed(false); }}
        onLoadedMetadata={(event) => {
          const length = event.currentTarget.duration;
          setDuration(Number.isFinite(length) ? length : 0);
          setLoading(false);
        }}
        onDurationChange={(event) => {
          const length = event.currentTarget.duration;
          setDuration(Number.isFinite(length) ? length : 0);
        }}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onCanPlay={() => setLoading(false)}
        onWaiting={() => setLoading(true)}
        onPlay={() => { setPlaying(true); setLoading(false); setFailed(false); }}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrent(0); }}
        onError={() => { setLoading(false); setFailed(true); setPlaying(false); }}
      />

      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px]"
          style={{
            background: own
              ? "color-mix(in srgb, var(--tcy-bubble-own-fg) 14%, transparent)"
              : "color-mix(in srgb, var(--tcy-accent) 13%, transparent)",
            color: own ? foreground : "var(--tcy-accent)",
          }}
        >
          <Disc3 size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-1.5">
            <span
              className="shrink-0 rounded-[6px] border px-1.5 py-[2px] text-[9px] font-black tracking-[0.06em]"
              style={{
                borderColor: own ? "color-mix(in srgb, var(--tcy-bubble-own-fg) 18%, transparent)" : "var(--tcy-line)",
                color: muted,
                background: "color-mix(in srgb, var(--tcy-card-strong) 60%, transparent)",
              }}
            >
              {format}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-[0.1em]" style={{ color: muted }}>
              Музыка
            </span>
          </div>
          <div className="truncate text-[12.5px] font-bold" title={name}>{name}</div>
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => void togglePlayback()}
          disabled={!url || loading || failed}
          aria-label={playing ? "Пауза музыки" : "Воспроизвести музыку"}
          className="tcy-press flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-55"
          style={{
            background: own
              ? "color-mix(in srgb, var(--tcy-bubble-own-fg) 18%, transparent)"
              : "var(--tcy-accent)",
            color: own ? foreground : "var(--tcy-on-accent)",
          }}
        >
          {loading || !url
            ? <LoaderCircle size={16} className="animate-spin" />
            : playing
              ? <Pause size={16} fill="currentColor" />
              : <Play size={16} fill="currentColor" className="ml-0.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <input
            type="range"
            aria-label="Перемотка музыки"
            min={0}
            max={duration || 1}
            step={0.1}
            value={Math.min(current, duration || 1)}
            disabled={!duration || failed}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (audioRef.current) audioRef.current.currentTime = next;
              setCurrent(next);
            }}
            className="block h-1.5 w-full cursor-pointer disabled:opacity-35"
            style={{ accentColor: "var(--tcy-accent)" }}
          />
          <div className="mt-1 flex items-center justify-between text-[10px] font-semibold tabular-nums" style={{ color: muted }}>
            <span>{clock(current)}</span>
            <span>{duration ? clock(duration) : "--:--"}</span>
          </div>
        </div>
      </div>
      {failed && (
        <div role="status" className="mt-2 flex items-center justify-between gap-2 text-[10.5px]" style={{ color: "var(--tcy-danger)" }}>
          <span>Не удалось воспроизвести файл.</span>
          <button
            type="button"
            onClick={() => {
              setFailed(false);
              setLoading(true);
              audioRef.current?.load();
            }}
            className="tcy-press rounded-full border px-2.5 py-1 font-bold"
            style={{ borderColor: "var(--tcy-line)" }}
          >
            Повторить
          </button>
        </div>
      )}
    </div>
  );
}
