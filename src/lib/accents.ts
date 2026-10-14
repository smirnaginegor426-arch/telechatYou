export const ACCENTS = [
  { id: "purple", name: "Фиолетовый", color: "#8e79b5", deep: "#68548f", onAccent: "#ffffff", glow1: "rgba(142, 121, 181, 0.12)", glow2: "rgba(91, 135, 184, 0.07)" },
  { id: "blue", name: "Синий", color: "#5b87b8", deep: "#3f6391", onAccent: "#ffffff", glow1: "rgba(91, 135, 184, 0.12)", glow2: "rgba(86, 153, 163, 0.07)" },
  { id: "cyan", name: "Бирюзовый", color: "#5699a3", deep: "#3d747d", onAccent: "#ffffff", glow1: "rgba(86, 153, 163, 0.12)", glow2: "rgba(86, 153, 163, 0.07)" },
  { id: "green", name: "Зелёный", color: "#609a81", deep: "#40705b", onAccent: "#062b20", glow1: "rgba(96, 154, 129, 0.12)", glow2: "rgba(96, 154, 129, 0.07)" },
  { id: "orange", name: "Оранжевый", color: "#b98962", deep: "#8e6846", onAccent: "#1c1004", glow1: "rgba(185, 137, 98, 0.12)", glow2: "rgba(142, 121, 181, 0.07)" },
  { id: "red", name: "Красный", color: "#bd7480", deep: "#884e5a", onAccent: "#ffffff", glow1: "rgba(189, 116, 128, 0.12)", glow2: "rgba(189, 116, 128, 0.07)" },
  { id: "pink", name: "Розовый", color: "#ba7b9e", deep: "#86516f", onAccent: "#ffffff", glow1: "rgba(186, 123, 158, 0.12)", glow2: "rgba(186, 123, 158, 0.07)" },
] as const;

export type AccentId = (typeof ACCENTS)[number]["id"];

export function getAccent(accent: string) {
  return ACCENTS.find((item) => item.id === accent) ?? ACCENTS[0];
}

/**
 * Accent is intentionally limited to interactive surfaces. The page background,
 * body text and general cards stay neutral so the chosen color never floods
 * the entire app. Inputs, the navigation island, settings cards and highlights
 * read these accent-aware tokens.
 */
export function applyTheme(theme: "dark" | "light", accent: string) {
  const root = document.documentElement;
  const selected = getAccent(accent);
  const dark = theme === "dark";
  const mix = (percent: number, base: string) =>
    `color-mix(in srgb, ${selected.color} ${percent}%, ${base})`;

  root.dataset.theme = theme;
  root.dataset.accent = selected.id;

  const tokens: Record<string, string> = {
    /* Default decorative accents stay neutral outside the requested surfaces. */
    "--tcy-accent": dark ? "#e4e4e7" : "#52525b",
    "--tcy-accent-deep": dark ? "#a1a1aa" : "#27272a",
    "--tcy-on-accent": dark ? "#09090b" : "#fafafa",

    /* User-selected accent is scoped to navigation, inputs, settings and chat-list UI. */
    "--tcy-selected-accent": dark
      ? mix(78, "#a19aaa")
      : `color-mix(in srgb, ${selected.deep} 72%, #ffffff)`,
    "--tcy-selected-accent-deep": dark ? selected.deep : mix(18, "#27272a"),
    "--tcy-selected-on-accent": selected.onAccent,
    "--tcy-selected-header": dark
      ? mix(12, "rgba(5, 5, 6, 0.90)")
      : mix(7, "rgba(250, 250, 252, 0.92)"),
    "--tcy-selected-glass-line": dark
      ? mix(28, "rgba(255, 255, 255, 0.19)")
      : mix(18, "rgba(24, 24, 27, 0.14)"),
    "--tcy-selected-input": dark
      ? mix(9, "rgba(10, 11, 18, 0.58)")
      : mix(7, "rgba(255, 255, 255, 0.62)"),

    /* Keep the overall application background and ordinary surfaces neutral. */
    "--tcy-bg": dark ? "#050506" : "#f5f5f7",
    "--tcy-bg-2": dark ? "#09090b" : "#ededf0",
    "--tcy-card": dark
      ? "rgba(244, 244, 245, 0.035)"
      : "rgba(24, 24, 27, 0.035)",
    "--tcy-card-strong": dark
      ? "rgba(244, 244, 245, 0.075)"
      : "rgba(24, 24, 27, 0.075)",
    "--tcy-solid": dark ? "#0b0b0d" : "#ffffff",
    "--tcy-solid-2": dark ? "#111114" : "#f4f4f5",
    "--tcy-line": dark
      ? "rgba(244, 244, 245, 0.085)"
      : "rgba(24, 24, 27, 0.105)",
    "--tcy-line-strong": dark
      ? "rgba(244, 244, 245, 0.14)"
      : "rgba(24, 24, 27, 0.17)",
    "--tcy-text": dark ? "#f4f4f5" : "#18181b",
    "--tcy-dim": dark ? "#a1a1aa" : "#52525b",
    "--tcy-faint": dark ? "#71717a" : "#71717a",
    "--tcy-danger": dark ? "#fb7185" : "#e11d48",
    "--tcy-bubble-in": dark
      ? "rgba(244, 244, 245, 0.045)"
      : "rgba(24, 24, 27, 0.045)",

    /* Neutral base for ordinary headers, forms and ambient background. */
    "--tcy-header": dark ? "rgba(5, 5, 6, 0.82)" : "rgba(250, 250, 252, 0.88)",
    "--tcy-glass-line": dark ? "rgba(255, 255, 255, 0.19)" : "rgba(24, 24, 27, 0.14)",
    "--tcy-input": dark ? "rgba(10, 11, 18, 0.58)" : "rgba(255, 255, 255, 0.62)",
    "--tcy-glow-1": dark ? "rgba(255, 255, 255, 0.035)" : "rgba(24, 24, 27, 0.035)",
    "--tcy-glow-2": dark ? "rgba(148, 163, 184, 0.035)" : "rgba(100, 116, 139, 0.045)",
  };

  Object.entries(tokens).forEach(([key, value]) => root.style.setProperty(key, value));
  root.style.colorScheme = theme;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#050506" : "#f5f5f7");
}
