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
 * The selected accent tints the whole application surface system, not just controls.
 * Values use color-mix so the same accent generates coordinated dark and light palettes.
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
    "--tcy-accent": dark ? selected.color : mix(8, selected.deep),
    "--tcy-accent-deep": dark ? selected.deep : mix(18, "#27272a"),
    "--tcy-on-accent": dark ? selected.onAccent : "#ffffff",
    "--tcy-bg": mix(dark ? 22 : 8, dark ? "#050506" : "#f5f5f7"),
    "--tcy-bg-2": mix(dark ? 28 : 10, dark ? "#09090b" : "#ededf0"),
    "--tcy-card": dark
      ? `color-mix(in srgb, ${selected.color} 12%, rgba(244, 244, 245, 0.035))`
      : `color-mix(in srgb, ${selected.color} 8%, rgba(24, 24, 27, 0.035))`,
    "--tcy-card-strong": dark
      ? `color-mix(in srgb, ${selected.color} 17%, rgba(244, 244, 245, 0.075))`
      : `color-mix(in srgb, ${selected.color} 10%, rgba(24, 24, 27, 0.075))`,
    "--tcy-solid": mix(dark ? 15 : 5, dark ? "#0b0b0d" : "#ffffff"),
    "--tcy-solid-2": mix(dark ? 22 : 8, dark ? "#111114" : "#f4f4f5"),
    "--tcy-line": dark
      ? `color-mix(in srgb, ${selected.color} 23%, rgba(244, 244, 245, 0.085))`
      : `color-mix(in srgb, ${selected.color} 17%, rgba(24, 24, 27, 0.105))`,
    "--tcy-line-strong": dark
      ? `color-mix(in srgb, ${selected.color} 30%, rgba(244, 244, 245, 0.14))`
      : `color-mix(in srgb, ${selected.color} 22%, rgba(24, 24, 27, 0.17))`,
    "--tcy-text": dark ? "#f8fafc" : "#18181b",
    "--tcy-dim": dark ? mix(10, "#a1a1aa") : mix(6, "#52525b"),
    "--tcy-faint": dark ? mix(14, "#85858f") : mix(7, "#71717a"),
    "--tcy-danger": dark ? "#fb7185" : "#e11d48",
    "--tcy-bubble-in": dark
      ? `color-mix(in srgb, ${selected.color} 13%, rgba(244, 244, 245, 0.045))`
      : `color-mix(in srgb, ${selected.color} 8%, rgba(24, 24, 27, 0.045))`,
    "--tcy-header": dark
      ? `color-mix(in srgb, ${selected.color} 19%, rgba(5, 5, 6, 0.82))`
      : `color-mix(in srgb, ${selected.color} 10%, rgba(250, 250, 252, 0.88))`,
    "--tcy-glass-line": dark
      ? `color-mix(in srgb, ${selected.color} 38%, rgba(255, 255, 255, 0.19))`
      : `color-mix(in srgb, ${selected.color} 24%, rgba(24, 24, 27, 0.14))`,
    "--tcy-input": dark
      ? `color-mix(in srgb, ${selected.color} 13%, rgba(10, 11, 18, 0.58))`
      : `color-mix(in srgb, ${selected.color} 8%, rgba(255, 255, 255, 0.62))`,
    "--tcy-glow-1": selected.glow1,
    "--tcy-glow-2": selected.glow2,
  };

  Object.entries(tokens).forEach(([key, value]) => root.style.setProperty(key, value));
  root.style.colorScheme = theme;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? mix(22, "#050506") : mix(8, "#f5f5f7"));
}
