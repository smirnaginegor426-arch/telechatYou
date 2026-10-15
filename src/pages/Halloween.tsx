import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { HALLOWEEN_ICON_DATA } from "@/lib/halloween-icon";

type BatFlight = {
  x: number;
  y: number;
  rotate: number;
  delay: number;
  size: number;
};

const batFlights: BatFlight[] = [
  { x: -112, y: -98, rotate: -24, delay: 0.1, size: 26 },
  { x: 118, y: -106, rotate: 25, delay: 0.42, size: 28 },
  { x: -145, y: -5, rotate: -14, delay: 0.76, size: 25 },
  { x: 148, y: 8, rotate: 18, delay: 1.08, size: 27 },
  { x: -103, y: 105, rotate: -34, delay: 1.4, size: 24 },
  { x: 108, y: 101, rotate: 31, delay: 1.72, size: 25 },
];

function getNextHalloween(now: Date) {
  const halloween = new Date(now.getFullYear(), 9, 31, 0, 0, 0, 0);
  return halloween.getTime() > now.getTime()
    ? halloween
    : new Date(now.getFullYear() + 1, 9, 31, 0, 0, 0, 0);
}

function Bat({ size }: { size: number }) {
  return (
    <svg width={size} height={Math.round(size * 0.72)} viewBox="0 0 32 23" fill="none" aria-hidden="true">
      <path d="M16 8.8C12.4 4.8 7.1 2 2 2.1c1.4 3.3 1.8 6.2.8 9.2 2.7-.6 5.1.5 7.2 3.6L13 12.4l3 7.4 3-7.4 3 2.5c2.1-3.1 4.5-4.2 7.2-3.6-1-3-.6-5.9.8-9.2C25.9 2 19.6 4.8 16 8.8Z" fill="#ffc078" stroke="#ff7a1a" strokeWidth="0.7" strokeLinejoin="round" />
      <circle cx="13.8" cy="9.6" r="0.8" fill="#2b0d07" />
      <circle cx="18.2" cy="9.6" r="0.8" fill="#2b0d07" />
    </svg>
  );
}

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline justify-center gap-2 leading-none">
      <span className="w-[3.3ch] text-right text-[clamp(1.35rem,5vw,1.8rem)] font-normal tabular-nums" style={{ color: "#fff2e5" }}>
        {String(value).padStart(2, "0")}
      </span>
      <span className="w-[5.5rem] text-left text-[12px] font-normal" style={{ color: "rgba(255, 208, 173, .8)" }}>
        {label}
      </span>
    </div>
  );
}

export default function Halloween() {
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
    <main
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden"
      style={{
        background: "radial-gradient(ellipse at 50% 50%, #32140f 0%, #160b0c 48%, #070708 100%)",
      }}
      aria-label="Halloween"
    >
      <section className="relative z-10 flex w-full flex-col items-center px-5">
        <div className="flex flex-col gap-3" aria-label="Обратный отсчёт до Хэллоуина">
          <TimeUnit value={days} label="дней" />
          <TimeUnit value={hours} label="часов" />
          <TimeUnit value={minutes} label="минут" />
          <TimeUnit value={seconds} label="секунд" />
        </div>

        <div className="relative mt-5 flex w-full max-w-[min(72vw,340px)] items-center justify-center" style={{ aspectRatio: "1 / 1" }}>
          {batFlights.map((bat, index) => (
            <motion.div
              key={index}
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 flex items-center justify-center"
              style={{ marginLeft: -bat.size / 2, marginTop: -bat.size * 0.36, width: bat.size, height: bat.size * 0.72 }}
              animate={reduceMotion ? { opacity: 0, scale: 0.1 } : {
                x: [0, bat.x * 0.58, bat.x, bat.x * 0.76, 0],
                y: [0, bat.y * 0.58, bat.y, bat.y * 0.35, 0],
                rotate: [0, bat.rotate, bat.rotate + 15, bat.rotate - 8, 0],
                scale: [0.08, 1, 0.82, 0.7, 0.08],
                opacity: [0, 1, 1, 1, 0],
                zIndex: [0, 30, 30, 20, 0],
              }}
              transition={reduceMotion ? { duration: 0.01 } : {
                duration: 3.2,
                delay: bat.delay,
                repeat: Infinity,
                repeatDelay: 2.1,
                times: [0, 0.25, 0.57, 0.82, 1],
                ease: "easeInOut",
              }}
            >
              <Bat size={bat.size} />
            </motion.div>
          ))}

          <motion.img
            src={HALLOWEEN_ICON_DATA}
            alt="Иконка TeleChat You на Хэллоуин"
            draggable={false}
            className="relative z-10 block h-full w-full object-contain"
            style={{ mixBlendMode: "screen" }}
            animate={reduceMotion ? undefined : { scale: [0.94, 1.04, 0.94] }}
            transition={{ duration: 3.1, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </section>
    </main>
  );
}
