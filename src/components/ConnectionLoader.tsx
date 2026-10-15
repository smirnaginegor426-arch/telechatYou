import { motion } from "framer-motion";

const splitTransition = {
  duration: 1.4,
  times: [0, 0.2, 0.8, 1],
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
      <div className="relative h-8 w-8" aria-hidden="true">
        {/* Two clipped semicircles form one dot, then split, spin twice, and rejoin. */}
        <motion.span
          className="absolute left-1/2 top-1/2 h-2.5 w-2.5 rounded-full tcy-accent-bg"
          style={{
            marginLeft: -5,
            marginTop: -5,
            clipPath: "inset(0 50% 0 0)",
          }}
          animate={{
            x: [0, -8, -8, 0],
            y: [0, -3, -3, 0],
            rotate: [0, 0, 720, 720],
          }}
          transition={splitTransition}
        />
        <motion.span
          className="absolute left-1/2 top-1/2 h-2.5 w-2.5 rounded-full tcy-accent-bg"
          style={{
            marginLeft: -5,
            marginTop: -5,
            clipPath: "inset(0 0 0 50%)",
          }}
          animate={{
            x: [0, 8, 8, 0],
            y: [0, 3, 3, 0],
            rotate: [0, 0, -720, -720],
          }}
          transition={splitTransition}
        />
      </div>
    </div>
  );
}
