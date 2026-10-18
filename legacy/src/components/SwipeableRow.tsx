import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useRef, type ReactNode } from "react";

export type SwipeAction = {
  key: string;
  icon: ReactNode;
  color: string;
  onTrigger: () => void;
};

/**
 * Swipe-left-to-reveal actions row for the chat list.
 * Snaps open at threshold; tap action fires and closes.
 */
export function SwipeableRow({
  actions,
  children,
  disabled,
}: {
  actions: SwipeAction[];
  children: ReactNode;
  disabled?: boolean;
}) {
  const x = useMotionValue(0);
  const width = actions.length * 68;
  const openRef = useRef(false);

  const close = () => {
    openRef.current = false;
    animate(x, 0, { type: "spring", stiffness: 500, damping: 40 });
  };

  return (
    <div className="relative overflow-hidden">
      <div
        className="absolute right-0 top-0 bottom-0 flex"
        style={{ width }}
      >
        {actions.map((a) => (
          <button
            key={a.key}
            onClick={() => {
              close();
              a.onTrigger();
            }}
            className="flex-1 flex items-center justify-center text-white"
            style={{ background: a.color }}
          >
            {a.icon}
          </button>
        ))}
      </div>
      <motion.div
        style={{ x }}
        drag={disabled ? false : "x"}
        dragConstraints={{ left: -width, right: 0 }}
        dragElastic={{ left: 0.15, right: 0.02 }}
        onDragEnd={(_, info) => {
          const shouldOpen = info.offset.x < -40 || info.velocity.x < -300;
          if (info.offset.x > 40 || info.velocity.x > 300) {
            close();
            return;
          }
          openRef.current = shouldOpen;
          animate(x, shouldOpen ? -width : 0, {
            type: "spring",
            stiffness: 500,
            damping: 40,
          });
        }}
        className="relative"
      >
        {children}
      </motion.div>
    </div>
  );
}

export function useSwipeHighlight(x: ReturnType<typeof useMotionValue<number>>) {
  return useTransform(x, [-200, 0], [1, 0]);
}
