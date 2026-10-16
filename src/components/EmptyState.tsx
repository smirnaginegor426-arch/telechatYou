import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  const normalizedTitle = title.toLowerCase();
  const mascot = normalizedTitle.includes("друг") || normalizedTitle.includes("люд")
    ? "🐰"
    : normalizedTitle.includes("архив")
      ? "🐼"
      : normalizedTitle.includes("поиск") || normalizedTitle.includes("нашли")
        ? "🦊"
        : normalizedTitle.includes("загруз") || normalizedTitle.includes("подключ")
          ? "🐢"
          : "🐱";

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className="flex flex-col items-center justify-center text-center px-8 py-14"
    >
      <div className="tcy-empty-mascot hidden" aria-hidden="true">{mascot}</div>
      <div
        className="tcy-empty-state-icon w-20 h-20 rounded-[28px] tcy-card flex items-center justify-center mb-5"
        style={{ color: "var(--tcy-accent)" }}
      >
        {icon}
      </div>
      <h3 className="text-[17px] font-bold tcy-text">{title}</h3>
      {hint && <p className="mt-1.5 text-[13.5px] tcy-dim max-w-[260px] leading-relaxed">{hint}</p>}
      {action && <div className="mt-6">{action}</div>}
    </motion.div>
  );
}
