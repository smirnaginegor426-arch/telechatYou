import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { TESTER_BADGE_IMAGE } from "@/lib/tester-badge-image";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

function TesterEmblemFallback({ size }: { size: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 256 256"
      className="shrink-0 object-contain"
    >
      <defs>
        <linearGradient id="tester-badge-blue" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#56b5ff" />
          <stop offset="52%" stopColor="#1684ed" />
          <stop offset="100%" stopColor="#0755bb" />
        </linearGradient>
        <radialGradient id="tester-badge-center" cx="38%" cy="28%" r="78%">
          <stop offset="0%" stopColor="#44a8f8" />
          <stop offset="72%" stopColor="#1674d5" />
          <stop offset="100%" stopColor="#0755bb" />
        </radialGradient>
      </defs>
      <g fill="url(#tester-badge-blue)">
        {Array.from({ length: 8 }, (_, index) => (
          <rect
            key={index}
            x="105"
            y="6"
            width="46"
            height="65"
            rx="17"
            transform={`rotate(${index * 45} 128 128)`}
          />
        ))}
        <circle cx="128" cy="128" r="91" />
      </g>
      <circle cx="128" cy="128" r="72" fill="#0753af" opacity="0.82" />
      <circle cx="128" cy="124" r="62" fill="url(#tester-badge-center)" stroke="#5cb8ff" strokeWidth="4" />
      <path
        d="M91 127 L118 154 L169 98"
        fill="none"
        stroke="#ffffff"
        strokeWidth="19"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Interactive tester emblem and bottom information sheet. */
export function TesterBadge({ size = 24 }: { size?: number }) {
  const [open, setOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

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

  const emblem = (displaySize: number) =>
    imageFailed ? (
      <TesterEmblemFallback size={displaySize} />
    ) : (
      <img
        src={TESTER_BADGE_IMAGE}
        alt=""
        draggable={false}
        onError={() => setImageFailed(true)}
        className="object-contain"
        style={{ width: displaySize, height: displaySize }}
      />
    );

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
        {emblem(size)}
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
                  <div className="px-6 pt-6 pb-10 safe-bottom flex flex-col items-center gap-4 text-center">
                    {emblem(110)}
                    <p className="max-w-[320px] text-[15.5px] leading-relaxed font-semibold tcy-text">
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
