export const ACCENTS = [
  { id: "purple", name: "Фиолетовый", color: "#9b5de5", deep: "#6d28d9", onAccent: "#ffffff", glow1: "rgba(155, 93, 229, 0.22)", glow2: "rgba(59, 130, 246, 0.12)" },
  { id: "blue", name: "Синий", color: "#1685f8", deep: "#075fc5", onAccent: "#ffffff", glow1: "rgba(22, 133, 248, 0.22)", glow2: "rgba(14, 165, 233, 0.12)" },
  { id: "cyan", name: "Бирюзовый", color: "#08abc2", deep: "#087f95", onAccent: "#ffffff", glow1: "rgba(8, 171, 194, 0.22)", glow2: "rgba(6, 182, 212, 0.12)" },
  { id: "green", name: "Зелёный", color: "#10b981", deep: "#047857", onAccent: "#062b20", glow1: "rgba(16, 185, 129, 0.22)", glow2: "rgba(5, 150, 105, 0.12)" },
  { id: "orange", name: "Оранжевый", color: "#ff8a24", deep: "#c65d0a", onAccent: "#1c1004", glow1: "rgba(255, 138, 36, 0.22)", glow2: "rgba(126, 34, 206, 0.12)" },
  { id: "red", name: "Красный", color: "#f43f5e", deep: "#be123c", onAccent: "#ffffff", glow1: "rgba(244, 63, 94, 0.22)", glow2: "rgba(225, 29, 72, 0.12)" },
  { id: "pink", name: "Розовый", color: "#ec4899", deep: "#be185d", onAccent: "#ffffff", glow1: "rgba(236, 72, 153, 0.22)", glow2: "rgba(190, 24, 93, 0.12)" },
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
