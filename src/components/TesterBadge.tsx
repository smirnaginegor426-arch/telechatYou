import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { TESTER_BADGE_IMAGE } from "@/lib/tester-badge-image";

/** Interactive tester emblem and bottom information sheet. */
export function TesterBadge({ size = 24 }: { size?: number }) {
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

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        aria-label="Подробнее о значке тестера"
        title="Тестер TeleChat You"
        onClick={openSheet}
        onKeyDown={onKeyDown}
        className="inline-flex shrink-0 cursor-pointer items-center justify-center align-middle rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tcy-accent)]"
        style={{ width: size, height: size }}
      >
        <img
          src={TESTER_BADGE_IMAGE}
          alt=""
          draggable={false}
          className="h-full w-full object-contain"
        />
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
                  <div className="px-6 pt-5 pb-8 safe-bottom flex flex-col items-center gap-3.5 text-center">
                    <img
                      src={TESTER_BADGE_IMAGE}
                      alt="Значок тестера TeleChat You"
                      draggable={false}
                      className="h-[92px] w-[92px] object-contain"
                    />
                    <p className="max-w-[300px] text-[15px] leading-relaxed font-semibold tcy-text">
                      Это официальный тестер мессенджера TeleChat You
                    </p>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="tcy-press mt-1 w-full max-w-[260px] rounded-full px-5 py-3 text-[14px] font-bold tcy-gradient-accent"
                      style={{ color: "var(--tcy-on-accent)" }}
                    >
                      Понятно
                    </button>
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
