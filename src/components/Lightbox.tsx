import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
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
                <motion.video
                  initial={{ scale: 0.96, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 28 }}
                  src={videoUrl}
                  controls
                  autoPlay
                  playsInline
                  preload="metadata"
                  className="max-h-full max-w-full rounded-[12px] bg-black object-contain"
                  onClick={(event) => event.stopPropagation()}
                  onError={(event) => {
                    event.currentTarget.pause();
                  }}
                />
              ) : (
                <div className="tcy-skeleton h-[200px] w-[260px] rounded-[18px]" />
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
