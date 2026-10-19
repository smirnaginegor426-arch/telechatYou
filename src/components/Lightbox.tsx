import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LoaderCircle, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useFileUrl } from "@/hooks/useFileUrl";
import { formatFileSize } from "@/lib/format";

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
  const [videoBuffering, setVideoBuffering] = useState(true);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    setVideoBuffering(true);
    setVideoError(false);
  }, [videoKey, videoUrl]);

  return (
    <AnimatePresence>
      {(imageKey || videoKey || fallbackName) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-50 flex flex-col"
          style={{ background: "rgba(0,0,0,0.94)", backdropFilter: "blur(10px)" }}
          onClick={onClose}
        >
          <div className="flex items-start justify-between px-4 py-4 safe-top">
            <div className="min-w-0">
              <div className="truncate text-[14.5px] font-bold text-white">
                {name ?? fallbackName ?? (isVideo ? "Видео" : "Фото")}
              </div>
              {subtitle && (
                <div className="mt-0.5 truncate text-[12px] font-semibold text-white/70">{subtitle}</div>
              )}
              {size ? <div className="text-[12px] text-white/60">{formatFileSize(size)}</div> : null}
            </div>
            <button
              type="button"
              aria-label={isVideo ? "Закрыть видео" : "Закрыть фотографию"}
              onClick={(event) => {
                event.stopPropagation();
                onClose();
              }}
              className="tcy-press flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center p-2 sm:p-4">
            {isVideo ? (
              videoUrl ? (
                <div
                  className="relative flex max-h-full max-w-full items-center justify-center"
                  onClick={(event) => event.stopPropagation()}
                >
                  <motion.video
                    key={videoUrl}
                    initial={{ scale: 0.96, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 28 }}
                    src={videoUrl}
                    controls
                    autoPlay
                    playsInline
                    preload="auto"
                    data-tcy-fullscreen-video="true"
                    className="max-h-[calc(100dvh-112px)] max-w-[calc(100vw-16px)] rounded-[12px] bg-black object-contain"
                    onLoadStart={() => {
                      setVideoBuffering(true);
                      setVideoError(false);
                    }}
                    onWaiting={() => setVideoBuffering(true)}
                    onStalled={() => setVideoBuffering(true)}
                    onCanPlay={() => {
                      setVideoBuffering(false);
                      setVideoError(false);
                    }}
                    onPlaying={() => setVideoBuffering(false)}
                    onError={() => {
                      setVideoBuffering(false);
                      setVideoError(true);
                    }}
                  />
                  {videoBuffering && !videoError && (
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[12px] bg-black/30">
                      <span className="flex h-[58px] w-[58px] items-center justify-center rounded-full border border-white/25 bg-black/45 text-white backdrop-blur-sm">
                        <LoaderCircle size={28} className="animate-spin" />
                      </span>
                    </span>
                  )}
                  {videoError && (
                    <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[12px] bg-black/80 px-5 text-center text-[13px] text-white">
                      <span>Не удалось загрузить видео</span>
                      <button
                        type="button"
                        className="rounded-full bg-white/15 px-4 py-2 font-semibold"
                        onClick={() => {
                          setVideoError(false);
                          setVideoBuffering(true);
                          const player = document.querySelector<HTMLVideoElement>("[data-tcy-fullscreen-video='true']");
                          if (player) {
                            player.load();
                            void player.play().catch(() => undefined);
                          }
                        }}
                      >
                        Повторить
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex h-[220px] w-[180px] flex-col items-center justify-center gap-3 rounded-[18px] bg-white/5 text-white/75">
                  <LoaderCircle size={30} className="animate-spin" />
                  <span className="text-[12px]">Загружаем видео…</span>
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
                  className="max-h-full max-w-full rounded-[18px] object-contain"
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
