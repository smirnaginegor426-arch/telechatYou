import { motion } from "framer-motion";

export function ConnectionLoader() {
  return (
    <div
      role="status"
      aria-label="Подключение к чатам"
      className="flex w-full items-center justify-center py-8"
    >
      <div className="relative h-8 w-8" aria-hidden="true">
        <motion.span
          className="absolute left-1/2 top-1/2 h-[8px] w-[8px] -translate-x-1/2 -translate-y-1/2 rounded-full tcy-accent-bg"
          animate={{
            x: [0, -9, -9, 0],
            y: [0, -2, -2, 0],
          }}
          transition={{
            duration: 1.15,
            times: [0, 0.36, 0.64, 1],
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.span
          className="absolute left-1/2 top-1/2 h-[8px] w-[8px] -translate-x-1/2 -translate-y-1/2 rounded-full tcy-accent-bg"
          animate={{
            x: [0, 9, 9, 0],
            y: [0, 2, 2, 0],
          }}
          transition={{
            duration: 1.25,
            times: [0, 0.28, 0.68, 1],
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>
    </div>
  );
}
