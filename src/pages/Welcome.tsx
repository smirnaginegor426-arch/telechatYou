import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router";
import { ArrowRight, Heart, Sparkles, Star, UsersRound } from "lucide-react";
import { Logo, Wordmark } from "@/components/Logo";
import { TcButton } from "@/components/TcButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { readSavedAccounts } from "@/lib/saved-accounts";

export default function Welcome() {
  const navigate = useNavigate();
  const savedAccounts = readSavedAccounts();
  const [screen, setScreen] = useState(0);

  return (
    <div className="tcy-welcome-page relative flex h-full w-full flex-col overflow-hidden">
      <div className="tcy-onboarding-decor" aria-hidden="true">
        <span className="tcy-onboarding-doodle" style={{ top: "14%", left: "9%", "--doodle-size": "28px" } as React.CSSProperties}>✦</span>
        <span className="tcy-onboarding-doodle" style={{ top: "22%", right: "10%", "--doodle-size": "26px", animationDelay: "1s" } as React.CSSProperties}>♡</span>
        <span className="tcy-onboarding-doodle" style={{ bottom: "24%", left: "12%", "--doodle-size": "32px", animationDelay: "1.7s" } as React.CSSProperties}>☁</span>
        <span className="tcy-onboarding-doodle" style={{ bottom: "35%", right: "11%", "--doodle-size": "23px", animationDelay: ".5s" } as React.CSSProperties}>✧</span>
      </div>

      <header className="relative z-10 flex shrink-0 items-center justify-between gap-3 px-5 pt-4 safe-top">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-[15px] tcy-brand-badge">
            <Logo size={28} />
          </span>
          <Wordmark />
        </div>
        <ThemeToggle />
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col justify-center px-5 pb-4">
        <AnimatePresence mode="wait" initial={false}>
          {screen === 0 ? (
            <motion.section
              key="hello"
              initial={{ opacity: 0, y: 20, scale: .96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -14, scale: .97 }}
              transition={{ type: "spring", stiffness: 230, damping: 24 }}
              className="tcy-onboarding-card mx-auto flex w-full max-w-[430px] flex-col items-center px-5 py-7 text-center sm:px-7"
            >
              <div className="relative mb-5 flex items-center justify-center">
                <span className="tcy-mascot-orbit" aria-hidden="true">✦</span>
                <motion.img
                  src="/mascots/cat.svg"
                  alt="Милый котёнок машет лапкой"
                  draggable={false}
                  className="tcy-onboarding-mascot h-[min(54vw,218px)] w-[min(54vw,218px)] object-contain"
                  animate={{ y: [0, -5, 0], rotate: [0, -1.8, 0, 1.8, 0] }}
                  transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
                />
                <span className="tcy-mascot-wave" aria-hidden="true">👋</span>
              </div>
              <span className="mb-3 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11.5px] font-extrabold tcy-onboarding-pill">
                <Heart size={13} fill="currentColor" /> Твой уютный мир общения
              </span>
              <h1 className="max-w-[350px] text-[clamp(28px,7vw,39px)] font-black leading-[1.08] tracking-tight tcy-text">
                Привет! Добро пожаловать в TeleChatYou!
              </h1>
              <p className="mt-4 max-w-[300px] text-[14px] leading-relaxed tcy-dim">
                Здесь можно болтать с друзьями, делиться улыбками и собирать любимые стикеры.
              </p>
            </motion.section>
          ) : (
            <motion.section
              key="create"
              initial={{ opacity: 0, y: 20, scale: .96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -14, scale: .97 }}
              transition={{ type: "spring", stiffness: 230, damping: 24 }}
              className="tcy-onboarding-card mx-auto flex w-full max-w-[430px] flex-col items-center px-5 py-7 text-center sm:px-7"
            >
              <div className="relative mb-5">
                <motion.img
                  src="/mascots/rabbit.svg"
                  alt="Весёлый кролик"
                  draggable={false}
                  className="tcy-onboarding-mascot h-[min(48vw,190px)] w-[min(48vw,190px)] object-contain"
                  animate={{ y: [0, -5, 0], rotate: [0, 2, 0] }}
                  transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
                />
                <span className="tcy-mascot-corner-spark" aria-hidden="true"><Sparkles size={24} /></span>
              </div>
              <span className="mb-3 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11.5px] font-extrabold tcy-onboarding-pill">
                <Star size={13} fill="currentColor" /> Всего несколько шагов
              </span>
              <h1 className="max-w-[350px] text-[clamp(29px,7vw,39px)] font-black leading-[1.08] tracking-tight tcy-text">
                Давай знакомиться!
              </h1>
              <p className="mt-4 max-w-[300px] text-[14px] leading-relaxed tcy-dim">
                Придумаем тебе имя, выберем аватарку и приготовим твой маленький уголок для общения.
              </p>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <footer className="relative z-10 shrink-0 px-5 pb-5 pt-2 safe-bottom">
        <div className="mx-auto w-full max-w-[430px]">
          <TcButton size="lg" onClick={() => screen === 0 ? setScreen(1) : navigate("/register")}>
            {screen === 0 ? "Ура, начать!" : "Создать аккаунт"} <ArrowRight size={19} />
          </TcButton>
          <div className="mt-4 flex items-center justify-center gap-2" aria-hidden="true">
            <span className={`h-2 rounded-full transition-all duration-300 ${screen === 0 ? "w-6" : "w-2"} tcy-step-dot`} />
            <span className={`h-2 rounded-full transition-all duration-300 ${screen === 1 ? "w-6" : "w-2"} tcy-step-dot`} />
          </div>
          <div className="mt-4 flex flex-col items-center gap-3">
            <button type="button" onClick={() => navigate("/login")} className="text-[12.5px] font-bold tcy-accent">
              Уже с нами? Войти
            </button>
            {savedAccounts.length > 0 && (
              <button
                type="button"
                onClick={() => navigate("/accounts")}
                className="flex h-10 items-center justify-center gap-2 rounded-[17px] border tcy-line tcy-card px-4 text-[12px] font-bold tcy-text"
              >
                <UsersRound size={15} className="tcy-accent" />
                Мои аккаунты ({savedAccounts.length})
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
