export const ACCENTS = [
  { id: "purple", name: "Фиолетовый", color: "#9b8bb3", deep: "#78678f", onAccent: "#ffffff", glow1: "rgba(142, 121, 181, 0.12)", glow2: "rgba(91, 135, 184, 0.07)" },
  { id: "blue", name: "Синий", color: "#7898ba", deep: "#58799c", onAccent: "#ffffff", glow1: "rgba(91, 135, 184, 0.12)", glow2: "rgba(86, 153, 163, 0.07)" },
  { id: "cyan", name: "Бирюзовый", color: "#78a3a8", deep: "#5f898e", onAccent: "#ffffff", glow1: "rgba(86, 153, 163, 0.12)", glow2: "rgba(86, 153, 163, 0.07)" },
  { id: "green", name: "Зелёный", color: "#7da18f", deep: "#5f806f", onAccent: "#062b20", glow1: "rgba(96, 154, 129, 0.12)", glow2: "rgba(96, 154, 129, 0.07)" },
  { id: "orange", name: "Оранжевый", color: "#b99a7d", deep: "#92775d", onAccent: "#1c1004", glow1: "rgba(185, 137, 98, 0.12)", glow2: "rgba(142, 121, 181, 0.07)" },
  { id: "red", name: "Красный", color: "#b98991", deep: "#916873", onAccent: "#ffffff", glow1: "rgba(189, 116, 128, 0.12)", glow2: "rgba(189, 116, 128, 0.07)" },
  { id: "pink", name: "Розовый", color: "#b58da5", deep: "#906e84", onAccent: "#ffffff", glow1: "rgba(186, 123, 158, 0.12)", glow2: "rgba(186, 123, 158, 0.07)" },
] as const;

export type AccentId = (typeof ACCENTS)[number]["id"];

export function getAccent(accent: string) {
  return ACCENTS.find((item) => item.id === accent) ?? ACCENTS[0];
}

/**
 * The chosen accent is deliberately softened: saturated swatches are blended
 * with each theme's neutral surface so navigation, buttons, inputs and highlights
 * feel translucent rather than neon. Text and page backgrounds remain neutral.
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
    "--tcy-accent": dark
      ? `color-mix(in srgb, ${selected.color} 54%, #a1a1aa)`
      : `color-mix(in srgb, ${selected.deep} 42%, #ffffff)`,
    "--tcy-accent-deep": dark
      ? `color-mix(in srgb, ${selected.deep} 46%, #71717a)`
      : `color-mix(in srgb, ${selected.deep} 42%, #d4d4d8)`,
    "--tcy-on-accent": selected.onAccent,

    /* User-selected accent is scoped to navigation, inputs, settings and chat-list UI. */
    "--tcy-selected-accent": dark
      ? mix(56, "#a19aaa")
      : `color-mix(in srgb, ${selected.deep} 50%, #ffffff)`,
    "--tcy-selected-accent-deep": dark
      ? `color-mix(in srgb, ${selected.deep} 52%, #71717a)`
      : `color-mix(in srgb, ${selected.deep} 40%, #d4d4d8)`,
    "--tcy-selected-on-accent": selected.onAccent,
    "--tcy-selected-header": dark
      ? mix(8, "rgba(5, 5, 6, 0.90)")
      : mix(4, "rgba(250, 250, 252, 0.92)"),
    "--tcy-selected-glass-line": dark
      ? mix(18, "rgba(255, 255, 255, 0.19)")
      : mix(12, "rgba(24, 24, 27, 0.14)"),
    "--tcy-selected-input": dark
      ? mix(5, "rgba(10, 11, 18, 0.58)")
      : mix(4, "rgba(255, 255, 255, 0.62)"),

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

    /* Calm message bubbles. Outgoing bubbles use a soft accent tint with a
       dedicated high-contrast text colour (instead of a bright accent fill with
       low-contrast text). Incoming bubbles stay a quiet neutral surface. */
    "--tcy-bubble-in": dark ? "rgba(244, 244, 245, 0.062)" : "#ffffff",
    "--tcy-bubble-own-bg": dark
      ? `color-mix(in srgb, ${selected.color} 30%, #121016)`
      : `color-mix(in srgb, ${selected.color} 24%, #ffffff)`,
    "--tcy-bubble-own-fg": dark
      ? `color-mix(in srgb, ${selected.color} 12%, #f6f4f9)`
      : `color-mix(in srgb, ${selected.deep} 80%, #2a2133)`,
    "--tcy-bubble-own-muted": dark
      ? "color-mix(in srgb, #f6f4f9 66%, transparent)"
      : "color-mix(in srgb, #2a2133 70%, transparent)",
    "--tcy-bubble-own-line": dark
      ? `color-mix(in srgb, ${selected.color} 38%, transparent)`
      : `color-mix(in srgb, ${selected.deep} 24%, transparent)`,

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
