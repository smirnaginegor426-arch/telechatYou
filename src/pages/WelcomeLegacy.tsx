import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router";
import { ArrowRight, UsersRound } from "lucide-react";
import { Logo } from "@/components/Logo";
import { TcButton } from "@/components/TcButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/hooks/useTheme";
import { readSavedAccounts } from "@/lib/saved-accounts";

type Point = { x: number; y: number };
const DIRECTIONS: Point[] = [
  { x: 72, y: -50 },
  { x: -72, y: -50 },
  { x: 72, y: 50 },
  { x: -72, y: 50 },
  { x: 0, y: -76 },
  { x: 0, y: 76 },
];

export default function Welcome() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const savedAccounts = readSavedAccounts();
  const [screen, setScreen] = useState(0);
  const [entrance, setEntrance] = useState<Point>(DIRECTIONS[0]);

  const next = () => {
    setEntrance(DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)]);
    setScreen(1);
  };

  const shapes = Array.from({ length: 12 }, (_, index) => ({
    id: index,
    size: 28 + (index % 5) * 22,
    left: (index * 19 + 3) % 96,
    top: (index * 29 + 7) % 94,
    radius: index % 3 === 0 ? "50%" : index % 3 === 1 ? "18px" : "7px",
  }));

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: "var(--tcy-bg)", transition: "background-color 800ms ease" }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(circle at 12% 18%, rgba(155,139,179,.20), transparent 38%), radial-gradient(circle at 88% 78%, rgba(91,135,184,.15), transparent 39%)" }}
        animate={{ opacity: theme === "dark" ? 1 : 0 }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(circle at 12% 18%, rgba(155,139,179,.16), transparent 38%), radial-gradient(circle at 88% 78%, rgba(224,179,106,.19), transparent 39%)" }}
        animate={{ opacity: theme === "light" ? 1 : 0 }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
      />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {shapes.map((shape) => (
          <motion.span
            key={shape.id}
            className="absolute block border"
            style={{
              width: shape.size,
              height: shape.size,
              left: shape.left + "%",
              top: shape.top + "%",
              borderRadius: shape.radius,
              borderColor: "color-mix(in srgb, var(--tcy-selected-accent) 28%, transparent)",
              background: "color-mix(in srgb, var(--tcy-selected-accent) 8%, transparent)",
            }}
            animate={{
              x: [0, shape.id % 2 ? 20 : -18, 0],
              y: [0, shape.id % 3 ? -24 : 18, 0],
              rotate: [0, shape.id % 2 ? 24 : -18, 0],
              scale: [1, 1.07, 1],
            }}
            transition={{ duration: 7 + shape.id * 0.7, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>

      <header className="relative z-10 flex shrink-0 items-center justify-between px-5 pt-4 safe-top">
        <div className="flex items-center gap-2">
          <Logo size={31} />
          <span className="text-[12px] font-black tracking-[0.11em] tcy-text">TELECHATYOU</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col justify-center px-6 pb-8">
        <AnimatePresence mode="wait" initial={false}>
          {screen === 0 ? (
            <motion.section
              key="welcome"
              initial={{ opacity: 0, x: entrance.x, y: entrance.y, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: -entrance.x, y: -entrance.y, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 240, damping: 27 }}
              className="mx-auto flex w-full max-w-[430px] flex-col items-center text-center"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.78, rotate: -12 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 220, damping: 20 }}
                className="mb-8 rounded-full"
              >
                <Logo size={104} />
              </motion.div>
              <h1 className="max-w-[390px] text-[clamp(29px,7vw,43px)] font-black leading-[1.08] tracking-[-0.04em] tcy-text">
                Добро пожаловать в TeleChatYou!
              </h1>
              <p className="mt-5 max-w-[300px] text-[14.5px] leading-relaxed tcy-dim">
                Твоё пространство для общения, идей и друзей.
              </p>
            </motion.section>
          ) : (
            <motion.section
              key="create"
              initial={{ opacity: 0, x: entrance.x, y: entrance.y, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: -entrance.x, y: -entrance.y, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 240, damping: 27 }}
              className="mx-auto flex w-full max-w-[430px] flex-col items-center text-center"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.75, rotate: 12 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 230, damping: 20 }}
                className="mb-8 flex h-[108px] w-[108px] items-center justify-center rounded-[34px] border tcy-line tcy-card-strong"
              >
                <UsersRound size={46} strokeWidth={1.65} className="tcy-accent" />
              </motion.div>
              <h1 className="max-w-[390px] text-[clamp(29px,7vw,42px)] font-black leading-[1.08] tracking-[-0.04em] tcy-text">
                Создай свой аккаунт прямо сейчас!
              </h1>
              <p className="mt-5 max-w-[300px] text-[14.5px] leading-relaxed tcy-dim">
                Всего несколько шагов — и можно общаться.
              </p>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <footer className="relative z-10 shrink-0 px-5 pb-6 pt-2 safe-bottom">
        <div className="mx-auto w-full max-w-[430px]">
          <TcButton size="lg" onClick={() => screen === 0 ? next() : navigate("/register")}>
            {screen === 0 ? "Начать" : "Начнём!"} <ArrowRight size={19} />
          </TcButton>
          <div className="mt-4 flex items-center justify-center gap-2">
            <span className="h-1.5 rounded-full transition-all duration-300" style={{ width: screen === 0 ? 22 : 7, background: "var(--tcy-selected-accent)" }} />
            <span className="h-1.5 rounded-full transition-all duration-300" style={{ width: screen === 1 ? 22 : 7, background: screen === 1 ? "var(--tcy-selected-accent)" : "var(--tcy-line-strong)" }} />
          </div>
          <div className="mt-4 flex flex-col items-center gap-3">
            <button type="button" onClick={() => navigate("/login")} className="text-[12.5px] font-bold tcy-accent">
              Уже есть аккаунт? Войти
            </button>
            {savedAccounts.length > 0 && (
              <button
                type="button"
                onClick={() => navigate("/accounts")}
                className="flex h-10 items-center justify-center gap-2 rounded-[15px] border tcy-line tcy-card px-4 text-[12px] font-bold tcy-text"
              >
                <UsersRound size={15} className="tcy-accent" />
                Сохранённые аккаунты ({savedAccounts.length})
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
