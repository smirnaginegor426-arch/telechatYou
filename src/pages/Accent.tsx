import { ArrowLeft, Check, Palette, Sparkles } from "lucide-react";
import { useNavigate } from "react-router";
import { ACCENTS } from "@/lib/accents";
import { useTheme } from "@/hooks/useTheme";

export default function AccentSettings() {
  const navigate = useNavigate();
  const { accent, setAccent } = useTheme();
  const selected = ACCENTS.find((option) => option.id === accent) ?? ACCENTS[0];

  return (
    <div className="tcy-accent-page relative h-full overflow-y-auto no-scrollbar pb-28">
      <header className="px-5 pt-5 safe-top pb-5">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Назад"
          className="tcy-glass-surface mb-4 flex h-10 w-10 items-center justify-center rounded-full tcy-text"
        >
          <ArrowLeft size={19} />
        </button>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[15px] tcy-gradient-accent" style={{ color: "var(--tcy-on-accent)" }}>
            <Palette size={21} />
          </span>
          <div>
            <h1 className="text-[24px] font-extrabold tcy-text">Акцент</h1>
            <p className="mt-0.5 text-[12.5px] tcy-dim">Цвет акцентных элементов интерфейса</p>
          </div>
        </div>
      </header>

      <div className="mx-4 mb-4 rounded-[25px] tcy-glass-surface p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px]" style={{ background: selected.color, color: selected.onAccent }}>
            <Sparkles size={22} />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] tcy-text">{selected.name}</p>
            <p className="mt-0.5 text-[12px] tcy-dim">Текущая цветовая тема</p>
          </div>
          <span className="ml-auto rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: "var(--tcy-accent)", color: "var(--tcy-on-accent)" }}>
            Выбрано
          </span>
        </div>
      </div>

      <div className="px-4">
        <p className="px-1 pb-3 text-[12px] uppercase tracking-[0.08em] tcy-faint">Выбери цвет</p>
        <div className="space-y-2">
          {ACCENTS.map((option) => {
            const active = option.id === accent;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() => setAccent(option.id)}
                className="tcy-press flex w-full items-center gap-3.5 rounded-[21px] border px-4 py-3.5 text-left transition-all duration-300"
                style={{
                  background: active ? "color-mix(in srgb, var(--tcy-accent) 14%, var(--tcy-card))" : "var(--tcy-card)",
                  borderColor: active ? "var(--tcy-accent)" : "var(--tcy-line)",
                  boxShadow: active ? "0 0 0 1px color-mix(in srgb, var(--tcy-accent) 28%, transparent), 0 10px 28px -20px var(--tcy-accent)" : "none",
                }}
              >
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all duration-300"
                  style={{
                    background: option.color,
                    boxShadow: active ? `0 0 0 3px var(--tcy-bg), 0 0 0 5px ${option.color}` : "0 4px 14px rgba(0,0,0,.2)",
                    transform: active ? "scale(1.03)" : "scale(1)",
                    color: option.onAccent,
                  }}
                >
                  {active && <Check size={19} strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] tcy-text">{option.name}</span>
                  <span className="mt-0.5 block text-[11.5px] tcy-dim">Акцентный цвет интерфейса: {option.name.toLowerCase()}</span>
                </span>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: option.color, opacity: active ? 1 : 0.45 }} />
              </button>
            );
          })}
        </div>
        <p className="px-1 pt-4 text-[11.5px] leading-relaxed tcy-faint">
          Акцент меняет островок навигации, поиск и поля ввода, ползунки, карточки настроек и оформление списка чатов. Фон приложения и обычные карточки остаются прежними. Выбор сохраняется на устройстве.
        </p>
      </div>
    </div>
  );
}
