import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, CalendarDays, Ghost, MoonStar, Sparkles } from "lucide-react";
import { HALLOWEEN_ICON_DATA } from "@/lib/halloween-icon";

type BatFlight = {
  x: number;
  y: number;
  rotate: number;
  delay: number;
  size: number;
};

const batFlights: BatFlight[] = [
  { x: -118, y: -106, rotate: -24, delay: 0.15, size: 27 },
  { x: 126, y: -115, rotate: 25, delay: 0.48, size: 29 },
  { x: -150, y: -9, rotate: -14, delay: 0.82, size: 26 },
  { x: 155, y: 8, rotate: 18, delay: 1.12, size: 28 },
  { x: -107, y: 112, rotate: -34, delay: 1.42, size: 24 },
  { x: 110, y: 108, rotate: 31, delay: 1.75, size: 26 },
];

function getNextHalloween(now: Date) {
  const thisHalloween = new Date(now.getFullYear(), 9, 31, 0, 0, 0, 0);
  return thisHalloween.getTime() > now.getTime()
    ? thisHalloween
    : new Date(now.getFullYear() + 1, 9, 31, 0, 0, 0, 0);
}

function BatSilhouette({ size }: { size: number }) {
  return (
    <svg width={size} height={Math.round(size * 0.72)} viewBox="0 0 32 23" fill="none" aria-hidden="true">
      <path
        d="M16 8.8C12.4 4.8 7.1 2 2 2.1c1.4 3.3 1.8 6.2.8 9.2 2.7-.6 5.1.5 7.2 3.6L13 12.4l3 7.4 3-7.4 3 2.5c2.1-3.1 4.5-4.2 7.2-3.6-1-3-.6-5.9.8-9.2C25.9 2 19.6 4.8 16 8.8Z"
        fill="#ffc078"
        stroke="#ff7a1a"
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
      <circle cx="13.8" cy="9.6" r="0.8" fill="#2b0d07" />
      <circle cx="18.2" cy="9.6" r="0.8" fill="#2b0d07" />
    </svg>
  );
}

function CountdownTile({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="min-w-0 rounded-2xl border px-1.5 py-3 text-center"
      style={{
        background: "rgba(15, 8, 8, 0.82)",
        borderColor: "rgba(255, 122, 26, 0.32)",
        boxShadow: "0 8px 24px rgba(0,0,0,.18)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="font-black tabular-nums leading-none text-[clamp(1.45rem,6vw,2rem)]" style={{ color: "#fff4e6" }}>
        {String(value).padStart(2, "0")}
      </div>
      <div className="mt-2 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "#f5a45b" }}>
        {label}
      </div>
    </div>
  );
}

export default function Halloween() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());
  const [target, setTarget] = useState(() => getNextHalloween(new Date()));

  useEffect(() => {
    const interval = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      setTarget((previous) =>
        previous.getTime() <= current ? getNextHalloween(new Date(current)) : previous,
      );
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const remaining = Math.max(0, target.getTime() - now);
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);

  return (
    <div
      className="relative h-full overflow-y-auto no-scrollbar"
      style={{
        background:
          "radial-gradient(ellipse at 50% 42%, rgba(111, 38, 12, 0.5) 0%, rgba(31, 13, 15, 0.92) 47%, #070708 100%)",
        color: "#fff4e6",
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-24 -left-20 h-64 w-64 rounded-full blur-3xl" style={{ background: "rgba(255, 103, 17, .13)" }} />
        <div className="absolute top-[42%] -right-24 h-60 w-60 rounded-full blur-3xl" style={{ background: "rgba(125, 32, 22, .18)" }} />
        <div className="absolute bottom-0 left-1/3 h-48 w-48 rounded-full blur-3xl" style={{ background: "rgba(255, 132, 22, .08)" }} />
      </div>

      <header className="relative z-20 flex items-center gap-3 px-4 pt-5 pb-4 safe-top">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Назад"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-transform active:scale-95"
          style={{
            background: "rgba(19, 12, 12, .72)",
            color: "#ffbd78",
            borderColor: "rgba(255, 139, 51, .28)",
            backdropFilter: "blur(14px)",
          }}
        >
          <ArrowLeft size={19} />
        </button>
        <div className="min-w-0">
          <h1 className="text-[21px] font-black tracking-tight">Halloween</h1>
          <p className="mt-0.5 text-[11px] font-medium" style={{ color: "#cba18c" }}>
            Обратный отсчёт до самой жуткой ночи
          </p>
        </div>
        <MoonStar className="ml-auto shrink-0" size={22} style={{ color: "#ff953e" }} />
      </header>

      <main className="relative z-10 flex min-h-[calc(100%-76px)] flex-col items-center px-4 pb-28 text-center">
        <div className="mt-3 flex items-center gap-2 rounded-full border px-3.5 py-2 text-[10px] font-extrabold uppercase tracking-[0.2em]"
          style={{ borderColor: "rgba(255, 137, 54, .28)", background: "rgba(20, 9, 8, .56)", color: "#ffb36d" }}>
          <CalendarDays size={13} />
          31 октября
        </div>

        <div className="mt-5 grid w-full max-w-[360px] grid-cols-4 gap-2 sm:gap-3" aria-label="Обратный отсчёт до Хэллоуина">
          <CountdownTile value={days} label="Дней" />
          <CountdownTile value={hours} label="Часов" />
          <CountdownTile value={minutes} label="Минут" />
          <CountdownTile value={seconds} label="Секунд" />
        </div>

        <div className="relative mt-3 flex w-full max-w-[360px] items-center justify-center" style={{ aspectRatio: "1 / 1" }}>
          <div className="absolute inset-0 rounded-full blur-3xl" style={{ background: "rgba(255, 92, 12, .15)", transform: "scale(.78)" }} />

          {batFlights.map((bat, index) => (
            <motion.div
              key={index}
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 flex items-center justify-center"
              style={{ marginLeft: -bat.size / 2, marginTop: -bat.size * 0.36, width: bat.size, height: bat.size * 0.72 }}
              animate={reduceMotion ? { opacity: 0.18, scale: 0.7 } : {
                x: [0, bat.x * 0.58, bat.x, bat.x * 0.76, 0],
                y: [0, bat.y * 0.58, bat.y, bat.y * 0.35, 0],
                rotate: [0, bat.rotate, bat.rotate + 15, bat.rotate - 8, 0],
                scale: [0.08, 1, 0.82, 0.7, 0.08],
                opacity: [0, 1, 1, 1, 0],
                zIndex: [0, 30, 30, 20, 0],
              }}
              transition={reduceMotion ? { duration: 0.01 } : {
                duration: 3.25,
                delay: bat.delay,
                repeat: Infinity,
                repeatDelay: 2.2,
                times: [0, 0.25, 0.57, 0.82, 1],
                ease: "easeInOut",
              }}
            >
              <BatSilhouette size={bat.size} />
            </motion.div>
          ))}

          <motion.div
            className="relative z-10 w-full overflow-hidden rounded-[28px] border"
            style={{
              borderColor: "rgba(255, 143, 64, .2)",
              boxShadow: "0 20px 65px rgba(0,0,0,.28), 0 0 46px rgba(255,91,10,.13)",
              lineHeight: 0,
            }}
            animate={reduceMotion ? undefined : { y: [0, -4, 0], rotate: [0, 0.5, 0] }}
            transition={{ duration: 5.4, repeat: Infinity, ease: "easeInOut" }}
          >
            <img
              src={HALLOWEEN_ICON_DATA}
              alt="Хэллоуинская иконка TeleChat You"
              className="block h-full w-full object-contain"
              draggable={false}
            />
          </motion.div>
        </div>

        <div className="mt-1 flex items-center justify-center gap-2 text-[12px] font-semibold" style={{ color: "#bd9989" }}>
          <Sparkles size={14} style={{ color: "#ff913d" }} />
          Летучие мыши уже кружат вокруг
          <Ghost size={14} style={{ color: "#ff913d" }} />
        </div>
        <p className="mt-2 max-w-[280px] text-[11px] leading-relaxed" style={{ color: "rgba(220, 190, 176, .62)" }}>
          Они вылетают из-за иконки каждые несколько секунд — и снова прячутся за ней.
        </p>
      </main>
    </div>
  );
}
