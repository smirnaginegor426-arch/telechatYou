import { motion } from "framer-motion";

const splitTransition = {
  duration: 1.8,
  times: [0, 0.24, 0.76, 1],
  repeat: Infinity,
  repeatDelay: 0.22,
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
        {/* Two clipped semicircles form one dot, then split, spin twice, and rejoin. */}
        <motion.span
          className="absolute left-1/2 top-1/2 h-3 w-3 rounded-full"
          style={{
            marginLeft: -6,
            marginTop: -6,
            backgroundColor: "var(--tcy-selected-accent)",
            clipPath: "inset(0 50% 0 0 round 50%)",
          }}
          animate={{
            x: [-3, -12, -12, -3],
            y: [0, -3, -3, 0],
            rotate: [0, -180, -540, -720],
            scale: [1, 1.08, 0.92, 1],
          }}
          transition={splitTransition}
        />
        <motion.span
          className="absolute left-1/2 top-1/2 h-2.5 w-2.5 rounded-full tcy-accent-bg"
          style={{
            marginLeft: -5,
            marginTop: -5,
            clipPath: "inset(0 0 0 50% round 50%)",
          }}
          animate={{
            x: [3, 12, 12, 3],
            y: [0, 3, 3, 0],
            rotate: [0, 180, 540, 720],
            scale: [1, 1.08, 0.92, 1],
          }}
          transition={splitTransition}
        />
      </div>
    </div>
  );
}
