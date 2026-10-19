import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  LoaderCircle,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useFileUrl } from "@/hooks/useFileUrl";
import { formatFileSize } from "@/lib/format";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const value = Math.floor(seconds);
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const remainder = value % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function Lightbox({
  imageKey,
  videoKey,
  name,
  subtitle,
  fallbackName,
  size,
  onClose,
}: {
  imageKey: string | null;
  videoKey?: string | null;
  name?: string | null;
  subtitle?: string | null;
  fallbackName?: string | null;
  size?: number | null;
  onClose: () => void;
}) {
  const url = useFileUrl(imageKey);
  const videoUrl = useFileUrl(videoKey ?? null);
  const isVideo = Boolean(videoKey);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoStageRef = useRef<HTMLDivElement | null>(null);
  const [videoBuffering, setVideoBuffering] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [retryNumber, setRetryNumber] = useState(0);

  useEffect(() => {
    setVideoBuffering(true);
    setVideoError(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    return () => {
      videoRef.current?.pause();
    };
  }, [videoKey, videoUrl, retryNumber]);

  const togglePlayback = async () => {
    const player = videoRef.current;
    if (!player || videoError) return;
    if (player.paused) {
      try {
        await player.play();
      } catch {
        // Playback policies may require a direct tap; the visible play button remains available.
        setIsPlaying(false);
      }
    } else {
      player.pause();
    }
  };

  const toggleFullscreen = async () => {
    const stage = videoStageRef.current;
    if (!stage) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stage.requestFullscreen?.();
    } catch {
      // Fullscreen is optional on browsers/WebViews that do not expose this API.
    }
  };

  const retryVideo = () => {
    setVideoError(false);
    setVideoBuffering(true);
    setIsPlaying(false);
    setCurrentTime(0);
    setRetryNumber((value) => value + 1);
  };

  return (
    <AnimatePresence>
      {(imageKey || videoKey || fallbackName) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-50 flex flex-col overflow-hidden"
          style={{
            background: isVideo
              ? "radial-gradient(ellipse at 50% 35%, rgba(49,49,65,0.62) 0%, rgba(12,12,17,0.97) 62%, #050506 100%)"
              : "rgba(0,0,0,0.94)",
            backdropFilter: "blur(18px)",
          }}
          onClick={onClose}
        >
          <div
            className="relative z-10 flex items-center justify-between gap-3 px-4 py-3 safe-top"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14.5px] font-bold text-white">
                {name ?? fallbackName ?? (isVideo ? "Видео" : "Фото")}
              </div>
              {subtitle && (
                <div className="mt-0.5 truncate text-[12px] font-semibold text-white/60">{subtitle}</div>
              )}
              {size ? <div className="mt-0.5 text-[11px] text-white/45">{formatFileSize(size)}</div> : null}
            </div>
            <button
              type="button"
              aria-label={isVideo ? "Закрыть видео" : "Закрыть фотографию"}
              onClick={onClose}
              className="tcy-press flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.08] text-white shadow-lg backdrop-blur-xl transition-colors hover:bg-white/[0.16]"
            >
              <X size={19} />
            </button>
          </div>

          <div
            className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-3 pt-1 sm:px-5"
            onClick={(event) => event.stopPropagation()}
          >
            {isVideo ? (
              videoUrl ? (
                <div
                  ref={videoStageRef}
                  className="relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden rounded-[24px]"
                  style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.035), rgba(255,255,255,0.005))" }}
                  onClick={(event) => event.stopPropagation()}
                >
                  <video
                    key={`${videoUrl}-${retryNumber}`}
                    ref={videoRef}
                    src={videoUrl}
                    autoPlay
                    playsInline
                    preload="auto"
                    className="max-h-full max-w-full rounded-[12px] bg-black object-contain shadow-[0_24px_90px_rgba(0,0,0,0.45)]"
                    onLoadStart={() => {
                      setVideoBuffering(true);
                      setVideoError(false);
                    }}
                    onLoadedMetadata={(event) => {
                      setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0);
                    }}
                    onDurationChange={(event) => {
                      setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0);
                    }}
                    onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                    onWaiting={() => setVideoBuffering(true)}
                    onStalled={() => setVideoBuffering(true)}
                    onCanPlay={() => {
                      setVideoBuffering(false);
                      setVideoError(false);
                    }}
                    onPlaying={() => {
                      setVideoBuffering(false);
                      setIsPlaying(true);
                    }}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => {
                      setIsPlaying(false);
                      setCurrentTime(videoRef.current?.duration ?? 0);
                    }}
                    onError={() => {
                      setVideoBuffering(false);
                      setVideoError(true);
                      setIsPlaying(false);
                    }}
                  />

                  {videoBuffering && !videoError && (
                    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/35 text-white">
                      <span className="flex h-[66px] w-[66px] items-center justify-center rounded-full border border-white/20 bg-black/45 shadow-2xl backdrop-blur-xl">
                        <LoaderCircle size={30} className="animate-spin" />
                      </span>
                      <span className="rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-[11px] font-semibold text-white/75 backdrop-blur-lg">
                        Загружаем видео…
                      </span>
                    </div>
                  )}

                  {videoError && (
                    <div role="status" className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-[22px] bg-black/80 px-5 text-center text-white">
                      <span className="text-[14px] font-semibold">Видео пока не удалось загрузить</span>
                      <button
                        type="button"
                        className="tcy-press inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2.5 text-[12.5px] font-bold hover:bg-white/15"
                        onClick={retryVideo}
                      >
                        <RotateCcw size={15} /> Повторить
                      </button>
                    </div>
                  )}

                  {!isPlaying && !videoBuffering && !videoError && (
                    <button
                      type="button"
                      aria-label="Воспроизвести видео"
                      onClick={() => void togglePlayback()}
                      className="tcy-press absolute left-1/2 top-1/2 z-10 flex h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white shadow-2xl backdrop-blur-xl transition-transform hover:scale-105 active:scale-95"
                    >
                      <Play size={30} fill="currentColor" className="ml-1" />
                    </button>
                  )}

                  {!videoError && (
                    <div
                      className="absolute bottom-3 left-3 right-3 z-20 rounded-[22px] border border-white/[0.13] bg-[#08080c]/75 p-3.5 text-white shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:bottom-5 sm:left-5 sm:right-5 sm:p-4"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3 text-[10.5px] font-semibold tabular-nums text-white/65">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                      </div>
                      <input
                        type="range"
                        aria-label="Перемотка видео"
                        min={0}
                        max={duration || 1}
                        step={0.1}
                        value={Math.min(currentTime, duration || 1)}
                        onChange={(event) => {
                          const next = Number(event.target.value);
                          if (videoRef.current) videoRef.current.currentTime = next;
                          setCurrentTime(next);
                        }}
                        className="mb-3 block h-1.5 w-full cursor-pointer rounded-full accent-white"
                        style={{ accentColor: "#e9e9f2" }}
                      />
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          aria-label={isPlaying ? "Пауза" : "Воспроизвести"}
                          onClick={() => void togglePlayback()}
                          className="tcy-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#111116] shadow-lg transition-transform hover:scale-105 active:scale-95"
                        >
                          {isPlaying ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" className="ml-0.5" />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-bold">{name ?? "Видео"}</p>
                          <p className="mt-0.5 text-[10px] font-medium text-white/45">TeleChat You · Видео</p>
                        </div>
                        <button
                          type="button"
                          aria-label={isMuted ? "Включить звук" : "Выключить звук"}
                          onClick={() => {
                            const player = videoRef.current;
                            if (!player) return;
                            const next = !player.muted;
                            player.muted = next;
                            setIsMuted(next);
                          }}
                          className="tcy-press flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.07] text-white/85 transition-colors hover:bg-white/[0.14]"
                        >
                          {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                        </button>
                        <button
                          type="button"
                          aria-label="Полноэкранный режим"
                          onClick={() => void toggleFullscreen()}
                          className="tcy-press flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.07] text-white/85 transition-colors hover:bg-white/[0.14]"
                        >
                          <Maximize2 size={17} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex h-[240px] w-[190px] flex-col items-center justify-center gap-3 rounded-[24px] border border-white/10 bg-white/[0.04] text-white/75 shadow-2xl backdrop-blur-xl">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.06]">
                    <LoaderCircle size={30} className="animate-spin" />
                  </span>
                  <span className="text-[12px] font-semibold">Загружаем видео…</span>
                  <span className="text-[10px] text-white/40">Подготавливаем плеер</span>
                </div>
              )
            ) : imageKey ? (
              url ? (
                <motion.img
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 28 }}
                  src={url}
                  alt={name ?? "Фото"}
                  className="max-h-full max-w-full rounded-[18px] object-contain shadow-[0_20px_70px_rgba(0,0,0,0.3)]"
                  onClick={(event) => event.stopPropagation()}
                />
              ) : (
                <div className="tcy-skeleton h-[200px] w-[260px] rounded-[18px]" />
              )
            ) : fallbackName ? (
              <div onClick={(event) => event.stopPropagation()}>
                <Avatar name={fallbackName} size={240} />
              </div>
            ) : null}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
