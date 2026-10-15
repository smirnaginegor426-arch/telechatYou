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
          className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full tcy-accent-bg"
          style={{ marginLeft: -4, marginTop: -4 }}
          animate={{ x: [0, -8, -8, 0] }}
          transition={{
            duration: 1.05,
            times: [0, 0.35, 0.65, 1],
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.span
          className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full tcy-accent-bg"
          style={{ marginLeft: -4, marginTop: -4 }}
          animate={{ x: [0, 8, 8, 0] }}
          transition={{
            duration: 1.05,
            times: [0, 0.35, 0.65, 1],
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>
    </div>
  );
}
