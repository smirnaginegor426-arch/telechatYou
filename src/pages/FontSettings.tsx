import { useState } from "react";
import { ArrowLeft, Check, Type } from "lucide-react";
import { useNavigate } from "react-router";
import { applyFontWeight, DEFAULT_FONT_WEIGHT, FONT_WEIGHT_STORAGE_KEY, getSavedFontWeight } from "@/lib/font-weight";

export default function FontSettings() {
  const navigate = useNavigate();
  const [draftWeight, setDraftWeight] = useState(() => getSavedFontWeight());
  const [saved, setSaved] = useState(false);

  const save = () => {
    const weight = applyFontWeight(draftWeight);
    try {
      localStorage.setItem(FONT_WEIGHT_STORAGE_KEY, String(weight));
    } catch {
      // Keep the selected font weight for this session when storage is unavailable.
    }
    setDraftWeight(weight);
    setSaved(true);
  };

  return (
    <div className="relative h-full overflow-y-auto no-scrollbar pb-28 tcy-font-settings-page">
      <header className="px-5 pt-5 safe-top pb-5">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Назад"
          className="tcy-press mb-4 flex h-10 w-10 items-center justify-center rounded-full tcy-card border tcy-line tcy-text"
        >
          <ArrowLeft size={19} />
        </button>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: "color-mix(in srgb, var(--tcy-selected-accent) 20%, var(--tcy-card))", color: "var(--tcy-selected-accent)" }}>
            <Type size={22} />
          </span>
          <div>
            <h1 className="text-[24px] font-extrabold tcy-text">Шрифт</h1>
            <p className="mt-0.5 text-[12.5px] tcy-dim">Выбери толщину текста для всего приложения</p>
          </div>
        </div>
      </header>

      <section className="mx-4 mb-5 rounded-[27px] border tcy-line tcy-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-extrabold tcy-text">Пример переписки</h2>
          <span className="rounded-full px-3 py-1 text-[12px] font-bold" style={{ background: "color-mix(in srgb, var(--tcy-selected-accent) 18%, var(--tcy-card))", color: "var(--tcy-selected-accent)" }}>
            {draftWeight}
          </span>
        </div>
        <div
          className="tcy-font-preview rounded-[22px] p-3.5 space-y-3"
          style={{ background: "color-mix(in srgb, var(--tcy-bg) 75%, var(--tcy-card))", "--tcy-preview-weight": draftWeight } as React.CSSProperties}
        >
          <div className="flex justify-start">
            <div className="max-w-[84%] rounded-[19px] rounded-bl-[7px] border tcy-line px-3.5 py-2.5" style={{ background: "var(--tcy-card-strong)", color: "var(--tcy-text)" }}>
              <p className="text-[14px] leading-relaxed">Привет! Как тебе новый мессенджер?</p>
              <p className="mt-1 text-right text-[10px] tcy-faint">12:40</p>
            </div>
          </div>
          <div className="flex justify-end">
            <div className="max-w-[84%] rounded-[19px] rounded-br-[7px] px-3.5 py-2.5" style={{ background: "var(--tcy-selected-accent)", color: "var(--tcy-selected-on-accent)" }}>
              <p className="text-[14px] leading-relaxed">Смотри, я могу менять толщину шрифта!</p>
              <p className="mt-1 text-right text-[10px] opacity-75">12:41 ✓✓</p>
            </div>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between text-[12px] tcy-dim">
          <span>Тонкий</span>
          <span>Жирный</span>
        </div>
        <input
          type="range"
          min={100}
          max={900}
          step={50}
          value={draftWeight}
          onChange={(event) => {
            setDraftWeight(Number(event.target.value));
            setSaved(false);
          }}
          aria-label="Толщина шрифта"
          className="tcy-audio-range mt-2 w-full"
        />
        <div className="mt-2 flex justify-between text-[11px] tcy-faint">
          <span>100</span>
          <span>500</span>
          <span>900</span>
        </div>
      </section>

      <div className="mx-4 rounded-[22px] tcy-card border tcy-line p-4">
        <p className="text-[13px] font-extrabold tcy-text">Текущая толщина: {draftWeight}</p>
        <p className="mt-1 text-[12px] tcy-dim">По умолчанию — {DEFAULT_FONT_WEIGHT}. Выбранное значение применится ко всему интерфейсу после сохранения.</p>
      </div>

      <div className="mx-4 mt-4">
        <button
          type="button"
          onClick={save}
          className="tcy-press flex h-12 w-full items-center justify-center gap-2 rounded-[18px] font-extrabold"
          style={{ background: "var(--tcy-selected-accent)", color: "var(--tcy-selected-on-accent)" }}
        >
          {saved ? <><Check size={18} strokeWidth={3} /> Сохранено</> : "Сохранить"}
        </button>
      </div>
    </div>
  );
}
