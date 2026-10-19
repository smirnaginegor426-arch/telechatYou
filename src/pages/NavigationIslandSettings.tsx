import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  MessageCircle,
  RotateCcw,
  Settings2,
  UserRound,
  Users,
} from "lucide-react";
import {
  DEFAULT_NAVIGATION_ISLAND_PREFERENCES,
  MAX_NAVIGATION_ISLAND_WIDTH,
  MIN_NAVIGATION_ISLAND_WIDTH,
  NAVIGATION_TAB_OPTIONS,
  getNavigationIslandPreferences,
  saveNavigationIslandPreferences,
  type NavigationIslandPreferences,
  type NavigationTabId,
} from "@/lib/navigation-island-preferences";

function getTabIcon(to: NavigationTabId) {
  if (to === "/") return MessageCircle;
  if (to === "/contacts") return Users;
  if (to === "/profile") return UserRound;
  return Settings2;
}

export default function NavigationIslandSettings() {
  const navigate = useNavigate();
  const [preferences, setPreferences] = useState<NavigationIslandPreferences>(
    getNavigationIslandPreferences,
  );

  const orderedTabs = useMemo(
    () => preferences.order
      .map((id) => NAVIGATION_TAB_OPTIONS.find((tab) => tab.to === id))
      .filter((tab): tab is (typeof NAVIGATION_TAB_OPTIONS)[number] => Boolean(tab)),
    [preferences.order],
  );

  const commit = (next: NavigationIslandPreferences) => {
    setPreferences(next);
    saveNavigationIslandPreferences(next);
  };

  const moveTab = (tabId: NavigationTabId, direction: -1 | 1) => {
    const order = [...preferences.order];
    const index = order.indexOf(tabId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return;
    [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
    commit({ ...preferences, order });
  };

  const reset = () => commit({
    ...DEFAULT_NAVIGATION_ISLAND_PREFERENCES,
    order: [...DEFAULT_NAVIGATION_ISLAND_PREFERENCES.order],
  });

  return (
    <div className="tcy-settings-page relative h-full overflow-y-auto no-scrollbar pb-32">
      <header className="relative z-10 flex items-center gap-3 px-5 pt-5 safe-top pb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Назад"
          className="tcy-press flex h-10 w-10 shrink-0 items-center justify-center rounded-full tcy-card border tcy-line tcy-dim"
        >
          <ArrowLeft size={19} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] font-extrabold tcy-text">Остров Навигации</h1>
          <p className="truncate text-[12.5px] tcy-faint">Настрой внешний вид и порядок вкладок</p>
        </div>
      </header>

      <div className="px-4">
        <div className="mb-3 px-1">
          <h2 className="text-[14px] font-extrabold tcy-text">Предпросмотр</h2>
          <p className="mt-0.5 text-[11.5px] tcy-dim">Ниже показано, как будет выглядеть меню чатов</p>
        </div>

        <div
          className="overflow-hidden rounded-[22px] border p-3.5"
          style={{ background: "var(--tcy-bg)", borderColor: "var(--tcy-line)" }}
        >
          <div className="flex items-center gap-2.5 px-1 pb-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{ background: "var(--tcy-card-strong)", color: "var(--tcy-selected-accent)" }}
            >
              <MessageCircle size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-extrabold tcy-text">Чаты</p>
              <p className="text-[10px] tcy-faint">Последние сообщения</p>
            </div>
            <span className="text-[11px] tcy-faint">⌕</span>
          </div>

          <div className="space-y-1.5">
            {[
              { name: "Алексей", text: "Отлично, увидимся!", initials: "А", color: "#597da8" },
              { name: "Мария", text: "Отправила фотографии", initials: "М", color: "#9a6da8" },
              { name: "Избранное", text: "Сохранённые сообщения", initials: "★", color: "#a68a54" },
            ].map((chat) => (
              <div
                key={chat.name}
                className="flex items-center gap-2.5 rounded-[13px] px-2.5 py-2"
                style={{ background: "var(--tcy-card)" }}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                  style={{ background: chat.color }}
                >
                  {chat.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-bold tcy-text">{chat.name}</p>
                  <p className="truncate text-[9.5px] tcy-dim">{chat.text}</p>
                </div>
                <span className="text-[9px] tcy-faint">12:40</span>
              </div>
            ))}
          </div>

          <div
            className="mx-auto mt-4 grid h-[48px] grid-cols-4 overflow-hidden rounded-full border p-1"
            style={{
              width: `min(${preferences.width}px, 100%)`,
              background: "var(--tcy-header)",
              borderColor: "var(--tcy-line-strong)",
              backdropFilter: "blur(18px) saturate(1.35)",
              WebkitBackdropFilter: "blur(18px) saturate(1.35)",
            }}
          >
            {orderedTabs.map((tab) => {
              const Icon = getTabIcon(tab.to);
              const active = tab.to === "/";
              return (
                <div
                  key={tab.to}
                  className="relative flex min-w-0 items-center justify-center rounded-full transition-colors duration-300"
                  style={{ color: active ? "var(--tcy-selected-accent)" : "var(--tcy-faint)" }}
                  title={tab.label}
                >
                  {active && (
                    <span
                      className="absolute inset-0 rounded-full"
                      style={{ background: "color-mix(in srgb, var(--tcy-selected-accent) 15%, transparent)" }}
                    />
                  )}
                  <Icon className="relative z-[1]" size={17} strokeWidth={active ? 2.4 : 1.8} />
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-center text-[9.5px] tcy-faint">
            Ширина островка: {preferences.width} px
          </p>
        </div>

        <section className="mt-5 rounded-[20px] border tcy-line tcy-card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[14px] font-extrabold tcy-text">Размер по ширине</h2>
              <p className="mt-0.5 text-[11px] tcy-dim">Подстрой островок под экран</p>
            </div>
            <span
              className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold tcy-text"
              style={{ background: "var(--tcy-card-strong)" }}
            >
              {preferences.width} px
            </span>
          </div>
          <input
            type="range"
            min={MIN_NAVIGATION_ISLAND_WIDTH}
            max={MAX_NAVIGATION_ISLAND_WIDTH}
            step={4}
            value={preferences.width}
            aria-label="Ширина острова навигации"
            onChange={(event) => commit({
              ...preferences,
              width: Number(event.currentTarget.value),
            })}
            className="w-full cursor-pointer"
            style={{ accentColor: "var(--tcy-selected-accent)" }}
          />
          <div className="mt-1 flex justify-between text-[10px] tcy-faint">
            <span>Компактный</span>
            <span>Широкий</span>
          </div>
        </section>

        <section className="mt-4 rounded-[20px] border tcy-line tcy-card p-4">
          <div className="mb-3">
            <h2 className="text-[14px] font-extrabold tcy-text">Порядок вкладок</h2>
            <p className="mt-0.5 text-[11px] tcy-dim">Перемещай вкладки стрелками</p>
          </div>
          <div className="space-y-1.5">
            {orderedTabs.map((tab, index) => {
              const Icon = getTabIcon(tab.to);
              return (
                <div
                  key={tab.to}
                  className="flex items-center gap-2.5 rounded-[14px] px-2.5 py-2"
                  style={{ background: "var(--tcy-card-strong)" }}
                >
                  <Icon size={17} className="shrink-0 tcy-accent" />
                  <span className="min-w-0 flex-1 text-[12.5px] font-semibold tcy-text">{tab.label}</span>
                  <button
                    type="button"
                    aria-label={`Переместить вкладку «${tab.label}» выше`}
                    disabled={index === 0}
                    onClick={() => moveTab(tab.to, -1)}
                    className="tcy-press flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-25"
                    style={{ color: "var(--tcy-text)", background: "var(--tcy-card)" }}
                  >
                    <ArrowUp size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Переместить вкладку «${tab.label}» ниже`}
                    disabled={index === orderedTabs.length - 1}
                    onClick={() => moveTab(tab.to, 1)}
                    className="tcy-press flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-25"
                    style={{ color: "var(--tcy-text)", background: "var(--tcy-card)" }}
                  >
                    <ArrowDown size={15} />
                  </button>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={reset}
            className="tcy-press mt-3 inline-flex items-center gap-2 rounded-full px-3 py-2 text-[11.5px] font-semibold tcy-dim"
            style={{ background: "var(--tcy-card-strong)" }}
          >
            <RotateCcw size={14} /> Сбросить настройки
          </button>
        </section>
      </div>
    </div>
  );
}
