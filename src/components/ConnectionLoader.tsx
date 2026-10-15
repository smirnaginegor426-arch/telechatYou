import { motion } from "framer-motion";

export function ConnectionLoader() {
  return (
    <div
      role="status"
      aria-label="Загрузка мессенджера"
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: "var(--tcy-bg)" }}
    >
      <svg
        aria-hidden="true"
        width="40"
        height="40"
        viewBox="0 0 24 24"
        className="overflow-visible"
      >
        <motion.circle
          r="2.15"
          fill="var(--tcy-selected-accent)"
          animate={{
            cx: [12, 6, 12, 18, 12],
            cy: [12, 12, 6, 12, 12],
            opacity: [0.88, 1, 1, 1, 0.88],
          }}
          transition={{
            duration: 1.15,
            times: [0, 0.25, 0.5, 0.75, 1],
            ease: "easeInOut",
            repeat: Infinity,
          }}
        />
        <motion.circle
          r="2.15"
          fill="var(--tcy-selected-accent)"
          animate={{
            cx: [12, 18, 12, 6, 12],
            cy: [12, 12, 18, 12, 12],
            opacity: [0.88, 1, 1, 1, 0.88],
          }}
          transition={{
            duration: 1.15,
            times: [0, 0.25, 0.5, 0.75, 1],
            ease: "easeInOut",
            repeat: Infinity,
          }}
        />
      </svg>
    </div>
  );
}
