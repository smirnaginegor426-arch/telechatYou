import { motion } from "framer-motion";

const splitTransition = {
  duration: 1.2,
  times: [0, 0.28, 0.72, 1],
  repeat: Infinity,
  ease: "easeInOut" as const,
};

export function ConnectionLoader() {
  return (
    <div
      role="status"
      aria-label="Загрузка чатов"
      className="flex min-h-[min(50vh,360px)] w-full items-center justify-center pointer-events-none"
    >
      <div className="relative h-10 w-10" aria-hidden="true">
        {/* Two complete dots start on the same point, separate, then merge into one point. */}
        <motion.span
          className="absolute left-1/2 top-1/2 h-3 w-3 rounded-full"
          style={{
            marginLeft: -6,
            marginTop: -6,
            backgroundColor: "var(--tcy-selected-accent)",
          }}
          animate={{
            x: [0, -8, -8, 0],
            y: [0, -2, -2, 0],
            scale: [0.55, 1, 1, 0.55],
          }}
          transition={splitTransition}
        />
        <motion.span
          className="absolute left-1/2 top-1/2 h-3 w-3 rounded-full"
          style={{
            marginLeft: -6,
            marginTop: -6,
            backgroundColor: "var(--tcy-selected-accent)",
          }}
          animate={{
            x: [0, 8, 8, 0],
            y: [0, 2, 2, 0],
            scale: [0.55, 1, 1, 0.55],
          }}
          transition={splitTransition}
        />
      </div>
    </div>
  );
}
