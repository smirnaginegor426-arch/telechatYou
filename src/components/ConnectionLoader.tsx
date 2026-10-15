import { motion } from "framer-motion";

export function ConnectionLoader() {
  return (
    <div
      role="status"
      aria-label="Загрузка чатов"
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
    >
      <div className="relative h-8 w-8" aria-hidden="true">
        <motion.span
          className="absolute left-1/2 top-1/2 h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full tcy-accent-bg"
          animate={{
            x: [0, -10, 0, 10, 0],
            y: [0, -6, -9, -6, 0],
            scale: [1, 0.96, 0.92, 0.96, 1],
          }}
          transition={{
            duration: 1.1,
            times: [0, 0.25, 0.5, 0.75, 1],
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.span
          className="absolute left-1/2 top-1/2 h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full tcy-accent-bg"
          animate={{
            x: [0, 10, 0, -10, 0],
            y: [0, 6, 9, 6, 0],
            scale: [1, 0.96, 0.92, 0.96, 1],
          }}
          transition={{
            duration: 1.1,
            times: [0, 0.25, 0.5, 0.75, 1],
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>
    </div>
  );
}
