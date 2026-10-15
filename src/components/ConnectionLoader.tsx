import { motion } from "framer-motion";

const transition = {
  duration: 1.25,
  times: [0, 0.16, 0.36, 0.58, 0.78, 1],
  repeat: Infinity,
  ease: "easeInOut" as const,
};

export function ConnectionLoader() {
  return (
    <div
      role="status"
      aria-label="Подключение к чатам"
      className="flex w-full items-center justify-center py-8"
    >
      <div className="relative h-12 w-12" aria-hidden="true">
        {/* Two synchronized copies start as one dot, split apart,
            orbit past one another, and meet at the exact same center again. */}
        <motion.span
          className="absolute left-1/2 top-1/2 h-[8px] w-[8px] -translate-x-1/2 -translate-y-1/2 rounded-full tcy-accent-bg"
          animate={{
            x: [0, -6, -10, -8, -3, 0],
            y: [0, -5, 0, 6, 4, 0],
            scale: [1, 0.95, 0.82, 0.92, 0.98, 1],
          }}
          transition={transition}
        />
        <motion.span
          className="absolute left-1/2 top-1/2 h-[8px] w-[8px] -translate-x-1/2 -translate-y-1/2 rounded-full tcy-accent-bg"
          animate={{
            x: [0, 6, 10, 8, 3, 0],
            y: [0, 5, 0, -6, -4, 0],
            scale: [1, 0.95, 0.82, 0.92, 0.98, 1],
          }}
          transition={transition}
        />
      </div>
    </div>
  );
}
