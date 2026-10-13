import { useEffect, useRef, useState } from "react";
import { Download, Music2, Pause, Play, Volume2 } from "lucide-react";
import { formatFileSize } from "@/lib/format";

function clock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const value = Math.floor(seconds);
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

export function AudioFilePlayer({
  url,
  name,
  size,
  own,
}: {
  url: string | null;
  name: string;
  size: number | null;
  own: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const main = own ? "var(--tcy-on-accent)" : "var(--tcy-text)";
  const muted = own
    ? "color-mix(in srgb, var(--tcy-on-accent) 64%, transparent)"
    : "var(--tcy-faint)";
  const ext = name.split(".").pop()?.toUpperCase() || "AUDIO";

  useEffect(() => () => audioRef.current?.pause(), []);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio || !url) return;
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setPlaying(false);
      }
    } else {
      audio.pause();
    }
  };

  return (
    <div className="tcy-audio-card w-[min(270px,68vw)] rounded-[20px] p-3" style={{
      color: main,
      background: own ? "color-mix(in srgb, var(--tcy-on-accent) 10%, transparent)" : "color-mix(in srgb, var(--tcy-card-strong) 72%, transparent)",
      border: `1px solid ${own ? "color-mix(in srgb, var(--tcy-on-accent) 18%, transparent)" : "var(--tcy-line)"}`,
    }}>
      <audio
        className="hidden"
        ref={audioRef}
        src={url ?? undefined}
        preload="metadata"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrent(0); }}
        onError={() => setPlaying(false)}
      />
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-10 h-10 rounded-[14px] shrink-0 flex items-center justify-center"
          style={{ background: own ? "color-mix(in srgb, var(--tcy-on-accent) 16%, transparent)" : "var(--tcy-accent)", color: own ? main : "var(--tcy-on-accent)" }}>
          <Music2 size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-bold truncate" title={name}>{name}</div>
          <div className="flex items-center gap-1.5 mt-0.5 text-[10px] font-bold" style={{ color: muted }}>
            <span>{ext}</span><span>•</span><span>{formatFileSize(size)}</span>
          </div>
        </div>
        <a href={url ?? undefined} download={name} aria-label="Скачать аудио"
          onClick={(event) => { if (!url) event.preventDefault(); }}
          className="tcy-press w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ color: muted }}>
          <Download size={15} />
        </a>
      </div>
      <div className="mt-3 flex items-center gap-2.5">
        <button type="button" onClick={() => void toggle()} disabled={!url} aria-label={playing ? "Пауза" : "Воспроизвести"}
          className="tcy-press w-9 h-9 rounded-full flex items-center justify-center shrink-0 disabled:opacity-50"
          style={{ background: own ? "color-mix(in srgb, var(--tcy-on-accent) 18%, transparent)" : "var(--tcy-accent)", color: own ? main : "var(--tcy-on-accent)" }}>
          {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <input aria-label="Позиция воспроизведения" className="tcy-audio-range w-full" type="range" min={0} max={duration || 1}
            step={0.1} value={Math.min(current, duration || 1)}
            onChange={(event) => { const next = Number(event.target.value); if (audioRef.current) audioRef.current.currentTime = next; setCurrent(next); }}
            style={{ accentColor: "var(--tcy-accent)" }} />
          <div className="flex justify-between text-[10px] font-semibold tabular-nums mt-0.5" style={{ color: muted }}>
            <span>{clock(current)}</span><span>{clock(duration)}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2 px-1" style={{ color: muted }}>
        <Volume2 size={13} />
        <input aria-label="Громкость аудио" className="tcy-audio-range w-20" type="range" min={0} max={1} step={0.05}
          value={volume}
          onChange={(event) => { const next = Number(event.target.value); setVolume(next); if (audioRef.current) audioRef.current.volume = next; }}
          style={{ accentColor: "var(--tcy-accent)" }} />
        <span className="ml-auto text-[10px] font-semibold">{url ? "Готово к прослушиванию" : "Загружаю аудио…"}</span>
      </div>
    </div>
  );
}
