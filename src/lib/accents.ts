export const ACCENTS = [
  { id: "purple", name: "Фиолетовый", color: "#9b5de5", deep: "#6d28d9", onAccent: "#ffffff", glow1: "rgba(155, 93, 229, 0.22)", glow2: "rgba(59, 130, 246, 0.12)" },
  { id: "blue", name: "Синий", color: "#1685f8", deep: "#075fc5", onAccent: "#06182e", glow1: "rgba(22, 133, 248, 0.22)", glow2: "rgba(14, 165, 233, 0.12)" },
  { id: "cyan", name: "Бирюзовый", color: "#08abc2", deep: "#087f95", onAccent: "#06252b", glow1: "rgba(8, 171, 194, 0.22)", glow2: "rgba(6, 182, 212, 0.12)" },
  { id: "green", name: "Зелёный", color: "#10b981", deep: "#047857", onAccent: "#062b20", glow1: "rgba(16, 185, 129, 0.22)", glow2: "rgba(5, 150, 105, 0.12)" },
  { id: "orange", name: "Оранжевый", color: "#ff8a24", deep: "#c65d0a", onAccent: "#1c1004", glow1: "rgba(255, 138, 36, 0.22)", glow2: "rgba(126, 34, 206, 0.12)" },
  { id: "red", name: "Красный", color: "#f43f5e", deep: "#be123c", onAccent: "#30040b", glow1: "rgba(244, 63, 94, 0.22)", glow2: "rgba(225, 29, 72, 0.12)" },
  { id: "pink", name: "Розовый", color: "#ec4899", deep: "#be185d", onAccent: "#33051f", glow1: "rgba(236, 72, 153, 0.22)", glow2: "rgba(190, 24, 93, 0.12)" },
] as const;

export type AccentId = (typeof ACCENTS)[number]["id"];

export function getAccent(accent: string) {
  return ACCENTS.find((item) => item.id === accent) ?? ACCENTS[0];
}

function hexToHsl(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / delta + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / delta + 2) / 6; break;
      default: h = ((r - g) / delta + 4) / 6; break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

/** Apply the selected accent as the actual full-screen theme. */
export function applyTheme(theme: "dark" | "light", accent: string) {
  const root = document.documentElement;
  const selected = getAccent(accent);
  const darkInk = selected.onAccent !== "#ffffff";
  const [h, s, l] = hexToHsl(selected.color);
  const [fgH, fgS, fgL] = hexToHsl(selected.onAccent);
  const shade = (lightness: number, saturation = s) =>
    `${h} ${Math.max(0, Math.min(100, saturation))}% ${Math.max(0, Math.min(100, lightness))}%`;
  const mix = (percent: number, other: string) =>
    `color-mix(in srgb, ${selected.color} ${percent}%, ${other})`;

  root.dataset.theme = theme;
  root.dataset.accent = selected.id;

  const surface = darkInk ? "rgba(255, 255, 255, 0.20)" : "rgba(5, 4, 12, 0.22)";
  const surfaceStrong = darkInk ? "rgba(255, 255, 255, 0.31)" : "rgba(5, 4, 12, 0.34)";
  const borderInk = darkInk ? "#101820" : "#ffffff";
  const cardLightness = darkInk ? Math.min(94, l + 12) : Math.max(8, l - 13);
  const secondaryLightness = darkInk ? Math.min(96, l + 7) : Math.max(6, l - 8);
  const fg = `${fgH} ${fgS}% ${fgL}%`;

  const tokens: Record<string, string> = {
    "--tcy-accent": selected.color,
    "--tcy-accent-deep": selected.deep,
    "--tcy-on-accent": selected.onAccent,
    "--tcy-bg": selected.color,
    "--tcy-bg-2": mix(58, selected.deep),
    "--tcy-card": surface,
    "--tcy-card-strong": surfaceStrong,
    "--tcy-solid": `color-mix(in srgb, ${selected.color} 82%, ${darkInk ? "#ffffff" : "#08060d"})`,
    "--tcy-solid-2": `color-mix(in srgb, ${selected.color} 72%, ${darkInk ? "#ffffff" : "#08060d"})`,
    "--tcy-line": `color-mix(in srgb, ${borderInk} 20%, transparent)`,
    "--tcy-line-strong": `color-mix(in srgb, ${borderInk} 34%, transparent)`,
    "--tcy-text": selected.onAccent,
    "--tcy-dim": `color-mix(in srgb, ${selected.onAccent} 78%, transparent)`,
    "--tcy-faint": `color-mix(in srgb, ${selected.onAccent} 62%, transparent)`,
    "--tcy-danger": darkInk ? "#7f1d1d" : "#fecdd3",
    "--tcy-bubble-in": surface,
    "--tcy-header": darkInk ? "rgba(255, 255, 255, 0.15)" : "rgba(4, 4, 10, 0.18)",
    "--tcy-glass-line": `color-mix(in srgb, ${selected.onAccent} 30%, transparent)`,
    "--tcy-input": darkInk ? "rgba(255, 255, 255, 0.24)" : "rgba(4, 4, 10, 0.20)",
    "--tcy-glow-1": selected.glow1,
    "--tcy-glow-2": selected.glow2,

    /* Update shared Tailwind/shadcn tokens too, not just custom TeleChat classes. */
    "--background": shade(l),
    "--foreground": fg,
    "--card": shade(cardLightness),
    "--card-foreground": fg,
    "--popover": shade(cardLightness),
    "--popover-foreground": fg,
    "--primary": shade(l),
    "--primary-foreground": fg,
    "--secondary": shade(secondaryLightness, Math.max(12, s - 8)),
    "--secondary-foreground": fg,
    "--muted": shade(secondaryLightness, Math.max(12, s - 8)),
    "--muted-foreground": fg,
    "--accent": shade(secondaryLightness, Math.max(12, s - 8)),
    "--accent-foreground": fg,
    "--destructive": "0 72% 48%",
    "--destructive-foreground": "0 0% 100%",
    "--border": shade(cardLightness, Math.max(12, s - 8)),
    "--input": shade(cardLightness, Math.max(12, s - 8)),
    "--ring": shade(l),
  };

  Object.entries(tokens).forEach(([key, value]) => root.style.setProperty(key, value));
  root.style.colorScheme = theme;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", selected.color);
}
