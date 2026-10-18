import { motion } from "framer-motion";
import { useNavigate } from "react-router";
import { Logo, Wordmark } from "@/components/Logo";
import { TcButton } from "@/components/TcButton";
import { LOGIN_PATH } from "@/const";
import { ArrowRight, ShieldCheck, Sparkles, Zap } from "lucide-react";

const points = [
  { icon: Zap, text: "Мгновенные сообщения и голосовые" },
  { icon: Sparkles, text: "Живые анимации и темы" },
  { icon: ShieldCheck, text: "Приватность по умолчанию" },
];

export default function Welcome() {
  const navigate = useNavigate();
  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      <div className="tcy-aurora" />
      {/* floating soft shapes */}
      {[...Array(7)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: 26 + (i % 4) * 16,
            height: 26 + (i % 4) * 16,
            left: `${8 + i * 13}%`,
            top: `${10 + (i % 3) * 18}%`,
            background: "var(--tcy-card-strong)",
            border: "1px solid var(--tcy-line)",
          }}
          animate={{ y: [0, -18 - i * 3, 0], rotate: [0, 12, 0] }}
          transition={{ duration: 6 + i, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8">
        <motion.div
          initial={{ scale: 0.6, opacity: 0, rotate: -14 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 240, damping: 20 }}
          className="tcy-shadow-accent rounded-full"
        >
          <Logo size={92} />
        </motion.div>
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 220, damping: 24 }}
          className="mt-7 text-center"
        >
          <Wordmark />
          <p className="mt-3 text-[14.5px] tcy-dim leading-relaxed max-w-[270px]">
            Общайтесь легко: чаты, группы, голосовые и файлы — в одном красивом приложении.
          </p>
        </motion.div>
        <div className="mt-9 w-full max-w-[300px] space-y-3">
          {points.map((p, i) => (
            <motion.div
              key={p.text}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 + i * 0.12, type: "spring", stiffness: 260, damping: 26 }}
              className="flex items-center gap-3.5 tcy-card border tcy-line rounded-[20px] px-4 py-3.5"
            >
              <span className="w-9 h-9 rounded-[13px] tcy-card-strong flex items-center justify-center tcy-accent">
                <p.icon size={17} />
              </span>
              <span className="text-[13.5px] font-semibold tcy-text">{p.text}</span>
            </motion.div>
          ))}
        </div>
      </div>

      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.55, type: "spring", stiffness: 220, damping: 26 }}
        className="relative z-10 px-6 pb-10 safe-bottom"
      >
        <TcButton size="lg" onClick={() => navigate(LOGIN_PATH)}>
          Начать <ArrowRight size={19} />
        </TcButton>
        <p className="text-center text-[11.5px] tcy-faint mt-4">
          Регистрация занимает меньше минуты
        </p>
      </motion.div>
    </div>
  );
}
