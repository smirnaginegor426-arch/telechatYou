import { useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { applyScreenColor, getSavedScreenColor, SCREEN_COLORS, type ScreenColorId } from "@/lib/screen-colors";

const PREVIEWS = [
  { id: "chat", title: "В чате" },
  { id: "channel", title: "В канале" },
  { id: "menu", title: "В меню" },
  { id: "profile", title: "В профиле" },
] as const;

function ChatPreview() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b px-3 py-3" style={{ background: "var(--tcy-solid)", borderColor: "var(--tcy-line)" }}>
        <div className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold" style={{ background: "var(--tcy-screen-color)", color: "#20232a" }}>А</div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-extrabold tcy-text">Алексей</p>
          <p className="text-[10px] tcy-dim">в сети</p>
        </div>
        <span className="text-[10px] tcy-dim">⋯</span>
      </div>
      <div className="flex flex-1 flex-col justify-end gap-2 p-3">
        <div className="max-w-[78%] self-start rounded-[15px] rounded-bl-[5px] px-3 py-2 text-[10.5px] tcy-text" style={{ background: "var(--tcy-solid)", border: "1px solid var(--tcy-line)" }}>Привет! Как тебе новый цвет?</div>
        <div className="max-w-[82%] self-end rounded-[15px] rounded-br-[5px] px-3 py-2 text-[10.5px]" style={{ background: "color-mix(in srgb, var(--tcy-screen-color) 28%, var(--tcy-solid))", color: "var(--tcy-text)", border: "1px solid color-mix(in srgb, var(--tcy-screen-color) 38%, var(--tcy-line))" }}>Очень приятный, глаза не устают ✨</div>
        <div className="mt-1 flex items-center rounded-full border px-3 py-2.5 text-[10.5px] tcy-faint" style={{ background: "var(--tcy-solid)", borderColor: "var(--tcy-line)" }}>Сообщение… <span className="ml-auto text-[14px]" style={{ color: "var(--tcy-screen-color)" }}>＋</span></div>
      </div>
    </div>
  );
}

function ChannelPreview() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b px-3 py-3" style={{ background: "var(--tcy-solid)", borderColor: "var(--tcy-line)" }}>
        <div className="flex h-9 w-9 items-center justify-center rounded-[13px] text-[10px] font-black" style={{ background: "var(--tcy-screen-color)", color: "#20232a" }}>TC</div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-extrabold tcy-text">TeleChat You</p>
          <p className="text-[10px] tcy-dim">Канал · 1 248 подписчиков</p>
        </div>
        <span className="text-[10px] tcy-dim">⋯</span>
      </div>
      <div className="p-3">
        <div className="overflow-hidden rounded-[16px] border" style={{ background: "var(--tcy-solid)", borderColor: "var(--tcy-line)" }}>
          <div className="h-2" style={{ background: "var(--tcy-screen-color)" }} />
          <div className="p-3">
            <p className="text-[12px] font-extrabold tcy-text">Новости мессенджера</p>
            <p className="mt-1.5 text-[10.5px] leading-relaxed tcy-dim">Новый спокойный оттенок уже доступен в настройках оформления.</p>
            <div className="mt-3 flex items-center justify-between text-[9.5px] tcy-faint"><span>Сегодня, 12:40</span><span>◉ 264</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MenuPreview() {
  const items = [
    ["◉", "Мои чаты"],
    ["♙", "Мой профиль"],
    ["⚙", "Настройки"],
    ["☆", "Избранное"],
  ];
  return (
    <div className="flex h-full flex-col p-3">
      <p className="px-2 pb-2 pt-1 text-[13px] font-extrabold tcy-text">Меню</p>
      <div className="overflow-hidden rounded-[17px] border" style={{ background: "var(--tcy-solid)", borderColor: "var(--tcy-line)" }}>
        {items.map(([icon, label], index) => (
          <div key={label} className="flex items-center gap-3 px-3 py-3" style={{ borderBottom: index === items.length - 1 ? 0 : "1px solid var(--tcy-line)" }}>
            <span className="flex h-7 w-7 items-center justify-center rounded-[10px] text-[12px]" style={{ background: "color-mix(in srgb, var(--tcy-screen-color) 22%, var(--tcy-bg))", color: "var(--tcy-text)" }}>{icon}</span>
            <span className="text-[11px] font-semibold tcy-text">{label}</span>
            <span className="ml-auto tcy-faint">›</span>
          </div>
        ))}
      </div>
      <p className="mt-3 px-2 text-[10px] leading-relaxed tcy-faint">Мягкий оттенок применяется к основным поверхностям приложения.</p>
    </div>
  );
}

function ProfilePreview() {
  return (
    <div className="flex h-full flex-col items-center px-4 pt-5 text-center">
      <div className="flex h-[58px] w-[58px] items-center justify-center rounded-full text-[20px] font-black" style={{ background: "var(--tcy-screen-color)", color: "#20232a" }}>Е</div>
      <p className="mt-3 text-[13px] font-extrabold tcy-text">Егор</p>
      <p className="mt-0.5 text-[10.5px] tcy-dim">@tester</p>
      <div className="mt-3 rounded-[15px] border px-3 py-2.5 text-left" style={{ background: "var(--tcy-solid)", borderColor: "var(--tcy-line)", width: "100%" }}>
        <p className="text-[10px] font-bold tcy-text">О себе</p>
        <p className="mt-1 text-[10px] tcy-dim">Рад общению в TeleChat You</p>
      </div>
      <div className="mt-3 flex w-full gap-2">
        <div className="flex-1 rounded-full py-2 text-[10px] font-bold tcy-text" style={{ background: "color-mix(in srgb, var(--tcy-screen-color) 32%, var(--tcy-solid))" }}>Сообщение</div>
        <div className="flex-1 rounded-full border py-2 text-[10px] font-bold tcy-text" style={{ borderColor: "var(--tcy-line)", background: "var(--tcy-solid)" }}>Позвонить</div>
      </div>
    </div>
  );
}

export default function ScreenColorSettings() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [selectedId, setSelectedId] = useState<ScreenColorId>(getSavedScreenColor);
  const [previewIndex, setPreviewIndex] = useState(0);
  const selected = SCREEN_COLORS.find((color) => color.id === selectedId) ?? SCREEN_COLORS[0];
  const activePreview = PREVIEWS[previewIndex];

  const chooseColor = (id: ScreenColorId) => {
    setSelectedId(id);
    applyScreenColor(theme, id);
  };
  const movePreview = (direction: -1 | 1) => {
    setPreviewIndex((current) => (current + direction + PREVIEWS.length) % PREVIEWS.length);
  };

  return (
    <div className="tcy-settings-page relative h-full overflow-y-auto no-scrollbar pb-32">
      <header className="relative z-10 flex items-center gap-3 px-5 pt-5 safe-top pb-4">
        <button
          type="button"
          onClick={() => navigate("/settings/appearance")}
          aria-label="Назад к внешнему виду"
          className="tcy-press flex h-10 w-10 shrink-0 items-center justify-center rounded-full tcy-card border tcy-line tcy-dim"
        >
          <ArrowLeft size={19} />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-[22px] font-extrabold tcy-text">Цвет экрана</h1>
          <p className="truncate text-[12.5px] tcy-faint">Спокойные оттенки для всего приложения</p>
        </div>
      </header>

      <div className="px-4">
        <div className="mb-3 flex items-end justify-between gap-3 px-1">
          <div>
            <p className="text-[14px] font-extrabold tcy-text">Предпросмотр</p>
            <p className="mt-0.5 text-[11.5px] tcy-dim">Свайпай, чтобы посмотреть другие экраны</p>
          </div>
          <span className="text-[11px] font-semibold tcy-dim">{activePreview.title}</span>
        </div>

        <div className="overflow-hidden rounded-[18px]">
          <div
            aria-label={`Предпросмотр: ${activePreview.title}`}
            className="h-[270px] overflow-hidden rounded-[18px] border transition-colors duration-300"
            style={{
              background: "var(--tcy-bg)",
              borderColor: "color-mix(in srgb, var(--tcy-line) 60%, transparent)",
              borderWidth: "1px",
              touchAction: "pan-y",
              userSelect: "none",
            }}
            onPointerDown={(event) => {
              event.currentTarget.dataset.previewStartX = String(event.clientX);
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerUp={(event) => {
              const startX = Number(event.currentTarget.dataset.previewStartX);
              delete event.currentTarget.dataset.previewStartX;
              if (!Number.isFinite(startX)) return;
              const delta = startX - event.clientX;
              if (delta > 45) movePreview(1);
              else if (delta < -45) movePreview(-1);
            }}
            onPointerCancel={(event) => {
              delete event.currentTarget.dataset.previewStartX;
            }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activePreview.id}
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.16 }}
                className="h-full"
              >
                {activePreview.id === "chat" && <ChatPreview />}
                {activePreview.id === "channel" && <ChannelPreview />}
                {activePreview.id === "menu" && <MenuPreview />}
                {activePreview.id === "profile" && <ProfilePreview />}
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex items-center justify-center gap-4 py-3">
            <button
              type="button"
              aria-label="Предыдущий пример"
              onClick={() => movePreview(-1)}
              className="flex h-8 w-8 items-center justify-center rounded-full border tcy-line tcy-card-strong tcy-dim"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-1.5">
              {PREVIEWS.map((preview, index) => (
                <button
                  key={preview.id}
                  type="button"
                  aria-label={preview.title}
                  aria-current={previewIndex === index ? "true" : undefined}
                  onClick={() => setPreviewIndex(index)}
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: previewIndex === index ? 18 : 6,
                    background: previewIndex === index ? "var(--tcy-selected-accent)" : "var(--tcy-line-strong)",
                  }}
                />
              ))}
            </div>
            <button
              type="button"
              aria-label="Следующий пример"
              onClick={() => movePreview(1)}
              className="flex h-8 w-8 items-center justify-center rounded-full border tcy-line tcy-card-strong tcy-dim"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className="mb-3 mt-6 flex items-center justify-between gap-3 px-1">
          <div>
            <p className="text-[14px] font-extrabold tcy-text">Выбери цвет</p>
            <p className="mt-0.5 text-[11.5px] tcy-dim">Оттенки специально приглушены</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-5 w-5 rounded-full border tcy-line" style={{ background: selected.id === "default" ? "var(--tcy-bg)" : selected.color }} />
            <span className="text-[11.5px] font-bold tcy-text">{selected.name}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {SCREEN_COLORS.map((color) => {
            const active = color.id === selectedId;
            return (
              <button
                key={color.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => chooseColor(color.id)}
                className="flex min-w-0 items-center gap-3 rounded-[17px] border p-3 text-left transition-all"
                style={{ background: active ? "var(--tcy-card-strong)" : "var(--tcy-card)", borderColor: active ? "var(--tcy-selected-accent)" : "var(--tcy-line)", boxShadow: active ? "0 0 0 1px var(--tcy-selected-accent)" : "none" }}
              >
                <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border" style={{ background: color.id === "default" ? "var(--tcy-bg-2)" : color.color, borderColor: "var(--tcy-line-strong)" }}>
                  {active && <Check size={17} strokeWidth={2.8} color={color.id === "default" ? "var(--tcy-text)" : "#ffffff"} />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-extrabold tcy-text">{color.name}</span>
                  <span className="mt-0.5 block text-[10px] leading-snug tcy-dim">{color.description}</span>
                </span>
              </button>
            );
          })}
        </div>

        <p className="px-2 pb-4 pt-4 text-center text-[11px] leading-relaxed tcy-faint">
          Цвет меняет оттенок фона, а не акцент кнопок. Настройка сохраняется на этом устройстве.
        </p>
      </div>
    </div>
  );
}
