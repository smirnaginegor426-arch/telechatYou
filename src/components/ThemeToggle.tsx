import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      aria-label={theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"}
      title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
      className="tcy-theme-toggle relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border tcy-line tcy-card"
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-full"
        style={{
          background: theme === "dark"
            ? "radial-gradient(circle at 25% 20%, rgba(161,139,197,.25), transparent 65%)"
            : "radial-gradient(circle at 25% 20%, rgba(232,190,111,.34), transparent 65%)",
          transition: "background 650ms ease",
        }}
      />
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ opacity: 0, rotate: -50, scale: 0.65 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 50, scale: 0.7 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
          className="relative z-10 flex items-center justify-center"
        >
          {theme === "dark" ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
