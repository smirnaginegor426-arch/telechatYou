import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { HALLOWEEN_ICON_DATA } from "@/lib/halloween-icon";
import { useExperimentalUI } from "@/hooks/useExperimentalUI";

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

/* Deterministic pseudo-random helper for star placement. */
function pseudoRandom(seed: number) {
  const value = Math.sin(seed) * 10_000;
  return value - Math.floor(value);
}

const halloweenStars = Array.from({ length: 44 }, (_, i) => ({
  left: pseudoRandom(i * 1.71 + 3.7) * 100,
  top: pseudoRandom(i * 2.37 + 1.3) * 58,
  size: 1 + pseudoRandom(i * 3.19 + 8.2) * 1.7,
  delay: pseudoRandom(i * 4.77 + 2.9) * 4,
  duration: 2.6 + pseudoRandom(i * 5.93 + 6.1) * 2.2,
  bright: i % 7 === 0,
}));

function createTransparentIcon(source: string): Promise<string> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context || !canvas.width || !canvas.height) {
          resolve(source);
          return;
        }

        context.drawImage(image, 0, 0);
        const frame = context.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = frame.data;
        const width = canvas.width;
        const height = canvas.height;
        const total = width * height;
        const visited = new Uint8Array(total);
        const queue = new Int32Array(total);
        let head = 0;
        let tail = 0;

        // Only remove near-black pixels connected to the image edges, so the
        // dark witch hat, lettering and bat details inside the icon remain intact.
        const isBackground = (pixel: number) => {
          const offset = pixel * 4;
          return pixels[offset] < 18 && pixels[offset + 1] < 18 && pixels[offset + 2] < 18;
        };
        const addPixel = (pixel: number) => {
          if (!visited[pixel] && isBackground(pixel)) {
            visited[pixel] = 1;
            queue[tail++] = pixel;
          }
        };

        for (let x = 0; x < width; x++) {
          addPixel(x);
          addPixel((height - 1) * width + x);
        }
        for (let y = 0; y < height; y++) {
          addPixel(y * width);
          addPixel(y * width + width - 1);
        }

        while (head < tail) {
          const pixel = queue[head++];
          const x = pixel % width;
          const y = Math.floor(pixel / width);
          pixels[pixel * 4 + 3] = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = x + dx;
              const ny = y + dy;
              if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
              addPixel(ny * width + nx);
            }
          }
        }

        context.putImageData(frame, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(source);
      }
    };
    image.onerror = () => resolve(source);
    image.src = source;
  });
}

function getNextHalloween(now: Date) {
  const halloween = new Date(now.getFullYear(), 9, 31, 0, 0, 0, 0);
  return halloween.getTime() > now.getTime()
    ? halloween
    : new Date(now.getFullYear() + 1, 9, 31, 0, 0, 0, 0);
}

function Bat({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={Math.round(size * 0.72)}
      viewBox="0 0 32 23"
      fill="none"
      aria-hidden="true"
    >
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

/* ————— Legacy countdown cell (the stable screen) ————— */
function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="flex min-w-[4.5rem] flex-col items-center justify-center gap-1 text-center leading-none"
      style={{ color: "var(--tcy-selected-on-accent)", fontFamily: "Arial, Helvetica, sans-serif", fontVariantNumeric: "tabular-nums", textShadow: "none" }}
    >
      <span className="text-[clamp(1.45rem,5.5vw,1.85rem)] font-normal">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-[12px] font-normal">
        {label}
      </span>
    </div>
  );
}

/* ————— Festive countdown tile (the experimental screen) ————— */
function CountdownTile({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="relative flex min-w-0 flex-col items-center justify-center rounded-[20px] border px-1 py-3 text-center transition-colors"
      style={{
        borderColor: "rgba(255,190,120,0.24)",
        background: "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.035))",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.14), 0 12px 30px -16px rgba(255,122,26,0.5)",
      }}
    >
      <span className="relative flex h-9 items-center justify-center overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={value}
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -12, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="block text-[clamp(1.3rem,5.6vw,1.62rem)] font-black leading-none"
            style={{ color: "#ffd9a8", fontVariantNumeric: "tabular-nums" }}
          >
            {String(value).padStart(2, "0")}
          </motion.span>
        </AnimatePresence>
      </span>
      <span
        className="mt-1 text-[9.5px] font-bold uppercase tracking-[0.16em]"
        style={{ color: "rgba(255,213,160,0.62)" }}
      >
        {label}
      </span>
    </div>
  );
}

export default function Halloween() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const { enabled: experimentalUI } = useExperimentalUI();
  const [now, setNow] = useState(() => Date.now());
  const [target, setTarget] = useState(() => getNextHalloween(new Date()));
  const [iconSrc, setIconSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void createTransparentIcon(HALLOWEEN_ICON_DATA).then((source) => {
      if (!cancelled) setIconSrc(source);
    });
    return () => { cancelled = true; };
  }, []);

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

  /* ————— Stable screen: unchanged flat accent design ————— */
  if (!experimentalUI) {
    return (
      <main
        className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden"
        style={{ background: "var(--tcy-selected-accent)" }}
        aria-label="Halloween"
      >
        <button
          type="button"
          aria-label="Выйти с экрана Halloween"
          onClick={() => navigate("/settings")}
          className="absolute z-50 flex h-10 w-10 items-center justify-center rounded-full p-0"
          style={{
            top: "max(16px, env(safe-area-inset-top))",
            left: "max(16px, env(safe-area-inset-left))",
            color: "#ff3b30",
            background: "rgba(255,255,255,0.14)",
            border: "1px solid rgba(255,255,255,0.3)",
            backdropFilter: "blur(16px) saturate(160%)",
            WebkitBackdropFilter: "blur(16px) saturate(160%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22)",
          }}
        >
          <X size={27} strokeWidth={2.5} />
        </button>

        <section className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-4 px-5 pt-8 pb-24">
          <div
            className="relative flex w-full max-w-[min(76vw,360px)] items-center justify-center"
            style={{ aspectRatio: "1 / 1", backgroundColor: "var(--tcy-selected-accent)" }}
          >
            {batFlights.map((bat, index) => (
              <motion.div
                key={index}
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-1/2 flex items-center justify-center"
                style={{
                  marginLeft: -bat.size / 2,
                  marginTop: -bat.size * 0.36,
                  width: bat.size,
                  height: bat.size * 0.72,
                }}
                animate={
                  reduceMotion
                    ? { opacity: 0, scale: 0.1 }
                    : {
                        x: [0, bat.x * 0.58, bat.x, bat.x * 0.76, 0],
                        y: [0, bat.y * 0.58, bat.y, bat.y * 0.35, 0],
                        rotate: [0, bat.rotate, bat.rotate + 15, bat.rotate - 8, 0],
                        scale: [0.08, 1, 0.82, 0.7, 0.08],
                        opacity: [0, 1, 1, 1, 0],
                        zIndex: [0, 30, 30, 20, 0],
                      }
                }
                transition={
                  reduceMotion
                    ? { duration: 0.01 }
                    : {
                        duration: 3.2,
                        delay: bat.delay,
                        repeat: Infinity,
                        repeatDelay: 2.1,
                        times: [0, 0.25, 0.57, 0.82, 1],
                        ease: "easeInOut",
                      }
                }
              >
                <Bat size={bat.size} />
              </motion.div>
            ))}

            <motion.div
              className="relative z-10 h-full w-full"
              style={{ background: "transparent", border: 0, outline: "none", boxShadow: "none" }}
              animate={reduceMotion ? undefined : { scale: [0.96, 1.025, 0.96] }}
              transition={{ duration: 3.1, repeat: Infinity, ease: "easeInOut" }}
            >
              <img
                src={iconSrc ?? HALLOWEEN_ICON_DATA}
                alt="Иконка TeleChat You на Хэллоуин"
                draggable={false}
                decoding="async"
                className="block h-full w-full object-contain"
                style={{
                  opacity: iconSrc ? 1 : 0,
                  mixBlendMode: "normal",
                  filter: "none",
                  imageRendering: "auto",
                  background: "transparent",
                  border: 0,
                  outline: "none",
                  boxShadow: "none",
                  WebkitTapHighlightColor: "transparent",
                }}
              />
            </motion.div>
          </div>

          <div
            className="flex flex-col items-center gap-4"
            aria-label="Обратный отсчёт до Хэллоуина"
          >
            <TimeUnit value={days} label="дней" />
            <TimeUnit value={hours} label="часов" />
            <TimeUnit value={minutes} label="минут" />
            <TimeUnit value={seconds} label="секунд" />
          </div>
        </section>
      </main>
    );
  }

  /* ————— Festive screen: Halloween night design (private experimental) ————— */
  return (
    <main
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden"
      style={{
        background:
          "radial-gradient(130% 90% at 50% 6%, #2a1650 0%, #1d0f3c 34%, #120a26 62%, #0a0518 100%)",
      }}
      aria-label="Halloween"
    >
      {/* twinkling stars */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
        {halloweenStars.map((star, index) => (
          <motion.span
            key={index}
            className="absolute rounded-full"
            style={{
              left: star.left + "%",
              top: star.top + "%",
              width: star.size,
              height: star.size,
              background: star.bright ? "#fff3dd" : "#d9c9ff",
              boxShadow: star.bright
                ? "0 0 6px 1px rgba(255,214,150,0.65)"
                : "0 0 4px 0px rgba(214,197,255,0.5)",
            }}
            animate={
              reduceMotion
                ? { opacity: 0.8 }
                : { opacity: [0.14, 0.95, 0.14], scale: [0.85, 1.15, 0.85] }
            }
            transition={{
              duration: star.duration,
              delay: star.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* drifting mist blobs */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-1/3 h-64 w-72 rounded-full"
        style={{ background: "rgba(255,122,26,0.10)", filter: "blur(52px)" }}
        animate={reduceMotion ? undefined : { x: [0, 34, -10, 0], y: [0, -18, 12, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 bottom-0 h-72 w-80 rounded-full"
        style={{ background: "rgba(122,63,255,0.14)", filter: "blur(56px)" }}
        animate={reduceMotion ? undefined : { x: [0, -30, 14, 0], y: [0, 16, -12, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* vignette */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1]"
      >
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(125% 92% at 50% 10%, transparent 52%, rgba(6,3,15,0.55) 100%)",
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-40"
          style={{
            background: "linear-gradient(180deg, transparent 0%, rgba(6,3,15,0.55) 100%)",
          }}
        />
      </div>

      <button
        type="button"
        aria-label="Выйти с экрана Halloween"
        onClick={() => navigate("/settings")}
        className="tcy-press absolute z-50 flex h-11 w-11 items-center justify-center rounded-full"
        style={{
          top: "max(16px, env(safe-area-inset-top))",
          left: "max(16px, env(safe-area-inset-left))",
          color: "#ffd9a8",
          background: "rgba(36,20,58,0.5)",
          border: "1px solid rgba(255,190,120,0.3)",
          backdropFilter: "blur(16px) saturate(160%)",
          WebkitBackdropFilter: "blur(16px) saturate(160%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16), 0 8px 22px -10px rgba(0,0,0,0.5)",
        }}
      >
        <X size={22} strokeWidth={2.4} />
      </button>

      <section className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-7 px-5 pt-10 pb-16">
        {/* icon with glow halo and flying bats */}
        <div className="relative flex w-full max-w-[min(64vw,290px)] items-center justify-center" style={{ aspectRatio: "1 / 1" }}>
          {/* breathing halo */}
          <motion.div
            aria-hidden="true"
            className="absolute inset-[4%] rounded-full"
            style={{
              background: "radial-gradient(circle at 50% 46%, rgba(255,150,60,0.34) 0%, rgba(255,110,30,0.16) 42%, transparent 68%)",
              filter: "blur(22px)",
            }}
            animate={
              reduceMotion
                ? undefined
                : { scale: [0.92, 1.08, 0.92], opacity: [0.6, 0.95, 0.6] }
            }
            transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* soft moon backlight */}
          <div
            aria-hidden="true"
            className="absolute inset-[10%] rounded-full"
            style={{
              background: "radial-gradient(circle at 50% 42%, rgba(255,236,200,0.16) 0%, transparent 62%)",
              filter: "blur(10px)",
            }}
          />

          {batFlights.map((bat, index) => (
            <motion.div
              key={index}
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 flex items-center justify-center"
              style={{
                marginLeft: -bat.size / 2,
                marginTop: -bat.size * 0.36,
                width: bat.size,
                height: bat.size * 0.72,
              }}
              animate={
                reduceMotion
                  ? { opacity: 0, scale: 0.1 }
                  : {
                      x: [0, bat.x * 0.58, bat.x, bat.x * 0.76, 0],
                      y: [0, bat.y * 0.58, bat.y, bat.y * 0.35, 0],
                      rotate: [0, bat.rotate, bat.rotate + 15, bat.rotate - 8, 0],
                      scale: [0.08, 1, 0.82, 0.7, 0.08],
                      opacity: [0, 1, 1, 1, 0],
                      zIndex: [0, 30, 30, 20, 0],
                    }
              }
              transition={
                reduceMotion
                  ? { duration: 0.01 }
                  : {
                      duration: 3.2,
                      delay: bat.delay,
                      repeat: Infinity,
                      repeatDelay: 2.1,
                      times: [0, 0.25, 0.57, 0.82, 1],
                      ease: "easeInOut",
                    }
              }
            >
              <Bat size={bat.size} />
            </motion.div>
          ))}

          <motion.div
            className="relative z-10 h-full w-full"
            style={{ background: "transparent", border: 0, outline: "none", boxShadow: "none" }}
            animate={
              reduceMotion
                ? undefined
                : { scale: [0.97, 1.02, 0.97], y: [0, -7, 0] }
            }
            transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <img
              src={iconSrc ?? HALLOWEEN_ICON_DATA}
              alt="Иконка TeleChat You на Хэллоуин"
              draggable={false}
              decoding="async"
              className="block h-full w-full object-contain"
              style={{
                opacity: iconSrc ? 1 : 0,
                mixBlendMode: "normal",
                filter: "drop-shadow(0 18px 34px rgba(255,110,30,0.28))",
                imageRendering: "auto",
                background: "transparent",
                border: 0,
                outline: "none",
                boxShadow: "none",
                WebkitTapHighlightColor: "transparent",
              }}
            />
          </motion.div>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <h1
            className="text-center font-black leading-tight tracking-tight"
            style={{
              fontSize: "clamp(1.62rem, 7vw, 2.15rem)",
              background: "linear-gradient(180deg, #ffe9cc 0%, #ffb066 58%, #ff8a3d 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              filter: "drop-shadow(0 10px 28px rgba(255,130,50,0.22))",
            }}
          >
            Скоро Хэллоуин
          </h1>
          <p
            className="text-[11.5px] font-bold uppercase"
            style={{ letterSpacing: "0.24em", color: "rgba(255,205,150,0.6)" }}
          >
            до 31 октября
          </p>
        </div>

        <div
          className="grid w-full max-w-[382px] grid-cols-4 gap-2.5"
          aria-label="Обратный отсчёт до Хэллоуина"
        >
          <CountdownTile value={days} label="дней" />
          <CountdownTile value={hours} label="часов" />
          <CountdownTile value={minutes} label="минут" />
          <CountdownTile value={seconds} label="секунд" />
        </div>
      </section>
    </main>
  );
}
