import { motion } from "framer-motion";

export function ConnectionLoader() {
  return (
    <div
      role="status"
      aria-label="Загрузка мессенджера"
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: "var(--tcy-bg)" }}
    >
      <div className="relative flex h-12 w-12 items-center justify-center" aria-hidden="true">
        <motion.span
          className="absolute h-[14px] w-[7px] rounded-l-full tcy-accent-bg"
          animate={{
            x: [0, -8, -8, 0],
            rotate: [0, -180, -360, -720],
            scaleY: [1, 0.92, 1, 1],
          }}
          transition={{
            duration: 1.25,
            times: [0, 0.28, 0.68, 1],
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.span
          className="absolute h-[14px] w-[7px] rounded-r-full tcy-accent-bg"
          animate={{
            x: [0, 8, 8, 0],
            rotate: [0, 180, 360, 720],
            scaleY: [1, 0.92, 1, 1],
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
