import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useFileUrl } from "@/hooks/useFileUrl";
import { formatFileSize } from "@/lib/format";

export function Lightbox({
  imageKey,
  name,
  size,
  onClose,
}: {
  imageKey: string | null;
  name?: string | null;
  size?: number | null;
  onClose: () => void;
}) {
  const url = useFileUrl(imageKey);
  return (
    <AnimatePresence>
      {imageKey && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-50 flex flex-col"
          style={{ background: "rgba(0,0,0,0.9)", backdropFilter: "blur(10px)" }}
          onClick={onClose}
        >
          <div className="flex items-center justify-between px-4 py-4 safe-top">
            <div className="min-w-0">
              <div className="text-[14.5px] font-bold text-white truncate">{name ?? "Фото"}</div>
              {size ? <div className="text-[12px] text-white/60">{formatFileSize(size)}</div> : null}
            </div>
            <button className="tcy-press w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4 min-h-0">
            {url ? (
              <motion.img
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 28 }}
                src={url}
                alt={name ?? "Фото"}
                className="max-w-full max-h-full object-contain rounded-[18px]"
              />
            ) : (
              <div className="tcy-skeleton w-[260px] h-[200px] rounded-[18px]" />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
