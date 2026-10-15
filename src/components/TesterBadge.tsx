import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";

/** Interactive badge that explains the TeleChat You tester status in a bottom sheet. */
export function TesterBadge({ size = 16 }: { size?: number }) {
  const [open, setOpen] = useState(false);

  const openSheet = (event: MouseEvent<HTMLSpanElement>) => {
    event.stopPropagation();
    setOpen(true);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    setOpen(true);
  };

  const iconSize = Math.max(10, Math.round(size * 0.625));

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        aria-label="Подробнее о значке тестера"
        title="Тестер TeleChat You"
        onClick={openSheet}
        onKeyDown={onKeyDown}
        className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full align-middle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tcy-accent)]"
        style={{
          width: size,
          height: size,
          background: "#3498db",
          color: "#ffffff",
        }}
      >
        <Check size={iconSize} strokeWidth={3.5} />
      </span>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <div className="fixed inset-0 z-[100] flex items-end justify-center">
                <motion.div
                  key="tester-sheet-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={(event) => {
                    event.stopPropagation();
                    setOpen(false);
                  }}
                  className="absolute inset-0"
                  style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
                />
                <motion.div
                  key="tester-sheet"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Официальный тестер TeleChat You"
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", stiffness: 380, damping: 38 }}
                  drag="y"
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={{ top: 0, bottom: 0.6 }}
                  onDragEnd={(_, info) => {
                    if (info.offset.y > 90 || info.velocity.y > 500) setOpen(false);
                  }}
                  onClick={(event) => event.stopPropagation()}
                  className="relative z-[101] w-full max-w-[520px] rounded-t-[30px] tcy-solid border-t tcy-line shadow-2xl"
                >
                  <div className="pt-3 pb-1 flex justify-center">
                    <div className="w-10 h-1.5 rounded-full" style={{ background: "var(--tcy-line-strong)" }} />
                  </div>
                  <div className="px-6 pt-6 pb-8 safe-bottom flex flex-col items-center gap-4 text-center">
                    <span
                      aria-hidden="true"
                      className="inline-flex shrink-0 items-center justify-center rounded-full"
                      style={{ width: 56, height: 56, background: "#3498db", color: "#ffffff" }}
                    >
                      <Check size={35} strokeWidth={3.5} />
                    </span>
                    <p className="max-w-[300px] text-[15px] leading-relaxed font-semibold tcy-text">
                      Это официальный тестер мессенджера TeleChat You
                    </p>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
