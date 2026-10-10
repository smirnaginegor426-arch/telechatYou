import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { useFileUrl } from "@/hooks/useFileUrl";
import { formatDuration } from "@/lib/format";

export type VoiceMeta = { duration: number; peaks: number[] };

export function parseVoiceMeta(raw: string | null): VoiceMeta | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    if (typeof p.duration === "number" && Array.isArray(p.peaks)) return p;
  } catch {
    /* ignore */
  }
  return null;
}

/** compute normalized peaks from an audio blob for the waveform */
export async function computePeaks(blob: Blob, bars = 40): Promise<VoiceMeta> {
  try {
    const ctx = new AudioContext();
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const data = buf.getChannelData(0);
    const block = Math.floor(data.length / bars) || 1;
    const peaks: number[] = [];
    for (let i = 0; i < bars; i++) {
      let max = 0;
      for (let j = 0; j < block; j += 8) {
        const v = Math.abs(data[i * block + j] ?? 0);
        if (v > max) max = v;
      }
      peaks.push(Math.max(0.12, Math.round(max * 100) / 100));
    }
    void ctx.close();
    return { duration: buf.duration, peaks };
  } catch {
    return { duration: 0, peaks: Array.from({ length: bars }, () => 0.3 + Math.random() * 0.6) };
  }
}

export function VoiceMessage({
  attachmentKey,
  voiceMeta,
  own,
}: {
  attachmentKey: string | null;
  voiceMeta: string | null;
  own: boolean;
}) {
  const url = useFileUrl(attachmentKey);
  const meta = parseVoiceMeta(voiceMeta);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const toggle = () => {
    if (!url) return;
    if (!audioRef.current) {
      const a = new Audio(url);
      audioRef.current = a;
      a.addEventListener("timeupdate", () => setProgress(a.currentTime / (a.duration || 1)));
      a.addEventListener("ended", () => {
        setPlaying(false);
        setProgress(0);
      });
    }
    const a = audioRef.current;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      void a.play();
      setPlaying(true);
    }
  };

  const bars = meta?.peaks ?? [];
  const activeBars = Math.floor(progress * bars.length);
  const main = own ? "var(--tcy-on-accent)" : "var(--tcy-text)";
  const faded = own ? "color-mix(in srgb, var(--tcy-on-accent) 45%, transparent)" : "var(--tcy-faint)";

  return (
    <div className="flex items-center gap-3 min-w-[190px] py-0.5">
      <button
        onClick={toggle}
        className="tcy-press w-10 h-10 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: own ? "color-mix(in srgb, var(--tcy-on-accent) 20%, transparent)" : "var(--tcy-accent)",
          color: own ? main : "var(--tcy-on-accent)",
        }}
        aria-label={playing ? "Пауза" : "Слушать"}
      >
        {playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" className="ml-0.5" />}
      </button>
      <div className="flex items-center gap-[2.5px] h-8 flex-1">
        {bars.map((h, i) => (
          <span
            key={i}
            className="w-[3px] rounded-full"
            style={{
              height: `${Math.max(14, h * 100) * 0.32}%`,
              minHeight: 4,
              background: i <= activeBars && playing ? main : faded,
              transition: "background 0.15s",
            }}
          />
        ))}
      </div>
      <span className="text-[11.5px] font-semibold tabular-nums" style={{ color: faded }}>
        {formatDuration(meta?.duration ?? 0)}
      </span>
    </div>
  );
}
