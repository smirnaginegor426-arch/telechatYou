export const SCREEN_COLORS = [
  { id: "default", name: "Стандартный", color: "#85858b", description: "Обычный фон TeleChat You" },
  { id: "sage", name: "Шалфей", color: "#91ad9b", description: "Спокойный зелёный оттенок" },
  { id: "mist", name: "Туман", color: "#829fbe", description: "Мягкий серо-голубой" },
  { id: "lavender", name: "Лаванда", color: "#a596ba", description: "Приглушённый лавандовый" },
  { id: "sand", name: "Песок", color: "#bba487", description: "Тёплый песочный" },
  { id: "sea", name: "Морская волна", color: "#7faea6", description: "Нежный оттенок морской волны" },
  { id: "rose", name: "Пыльная роза", color: "#bd929e", description: "Мягкий розово-серый" },
  { id: "slate", name: "Графит", color: "#858fa0", description: "Нейтральный прохладный" },
] as const;

export type ScreenColorId = (typeof SCREEN_COLORS)[number]["id"];

export function getSavedScreenColor(): ScreenColorId {
  try {
    const saved = localStorage.getItem("tcy-screen-color");
    return SCREEN_COLORS.find((item) => item.id === saved)?.id ?? "default";
  } catch {
    return "default";
  }
}

/**
 * Screen color softly tints the main app surfaces; it never replaces the
 * accent color, message text color, or status colors. Theme changes reapply
 * this function so the selected tint survives light/dark mode switches.
 */
export function applyScreenColor(theme: "dark" | "light", colorId: string) {
  const root = document.documentElement;
  const selected = SCREEN_COLORS.find((item) => item.id === colorId) ?? SCREEN_COLORS[0];
  const dark = theme === "dark";

  root.dataset.screenColor = selected.id;

  const base = dark
    ? {
        bg: "#141418",
        bg2: "#1a1a1f",
        solid: "#1d1d22",
        solid2: "#25252b",
      }
    : {
        bg: "#f5f5f7",
        bg2: "#ededf0",
        solid: "#ffffff",
        solid2: "#f4f4f5",
      };

  const mix = (neutral: string, neutralPercent: number) =>
    selected.id === "default"
      ? neutral
      : `color-mix(in srgb, ${neutral} ${neutralPercent}%, ${selected.color} ${100 - neutralPercent}%)`;

  root.style.setProperty("--tcy-screen-color", selected.color);
  // Slightly stronger tint adds depth while keeping text surfaces comfortable.
  root.style.setProperty("--tcy-bg", mix(base.bg, dark ? 66 : 59));
  root.style.setProperty("--tcy-bg-2", mix(base.bg2, dark ? 58 : 49));
  root.style.setProperty("--tcy-solid", mix(base.solid, dark ? 80 : 78));
  root.style.setProperty("--tcy-solid-2", mix(base.solid2, dark ? 73 : 70));

  // Tint the navigation island too, while preserving its selected accent.
  // Always blend from stable base tokens so repeated color changes never stack.
  const headerBase = getComputedStyle(root).getPropertyValue("--tcy-selected-header-base").trim();
  const glassLineBase = getComputedStyle(root).getPropertyValue("--tcy-selected-glass-line-base").trim();
  if (headerBase) {
    root.style.setProperty(
      "--tcy-selected-header",
      selected.id === "default"
        ? headerBase
        : `color-mix(in srgb, ${headerBase} 72%, ${selected.color} 28%)`,
    );
  }
  if (glassLineBase) {
    root.style.setProperty(
      "--tcy-selected-glass-line",
      selected.id === "default"
        ? glassLineBase
        : `color-mix(in srgb, ${glassLineBase} 70%, ${selected.color} 30%)`,
    );
  }

  try {
    localStorage.setItem("tcy-screen-color", selected.id);
  } catch {
    // The selected tint remains active for this session if storage is unavailable.
  }
}
