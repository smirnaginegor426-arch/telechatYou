export const ACCENTS = [
  {
    id: "purple",
    name: "Фиолетовый",
    color: "#9b5de5",
    deep: "#6d28d9",
    onAccent: "#ffffff",
    glow1: "rgba(155, 93, 229, 0.16)",
    glow2: "rgba(59, 130, 246, 0.08)",
  },
  {
    id: "blue",
    name: "Синий",
    color: "#1685f8",
    deep: "#075fc5",
    onAccent: "#ffffff",
    glow1: "rgba(22, 133, 248, 0.15)",
    glow2: "rgba(14, 165, 233, 0.08)",
  },
  {
    id: "cyan",
    name: "Бирюзовый",
    color: "#08abc2",
    deep: "#087f95",
    onAccent: "#ffffff",
    glow1: "rgba(8, 171, 194, 0.15)",
    glow2: "rgba(6, 182, 212, 0.08)",
  },
  {
    id: "green",
    name: "Зелёный",
    color: "#10b981",
    deep: "#047857",
    onAccent: "#062b20",
    glow1: "rgba(16, 185, 129, 0.15)",
    glow2: "rgba(5, 150, 105, 0.08)",
  },
  {
    id: "orange",
    name: "Оранжевый",
    color: "#ff8a24",
    deep: "#c65d0a",
    onAccent: "#1c1004",
    glow1: "rgba(255, 138, 36, 0.16)",
    glow2: "rgba(126, 34, 206, 0.08)",
  },
  {
    id: "red",
    name: "Красный",
    color: "#f43f5e",
    deep: "#be123c",
    onAccent: "#ffffff",
    glow1: "rgba(244, 63, 94, 0.15)",
    glow2: "rgba(225, 29, 72, 0.08)",
  },
  {
    id: "pink",
    name: "Розовый",
    color: "#ec4899",
    deep: "#be185d",
    onAccent: "#ffffff",
    glow1: "rgba(236, 72, 153, 0.15)",
    glow2: "rgba(190, 24, 93, 0.08)",
  },
] as const;

export type AccentId = (typeof ACCENTS)[number]["id"];

export function getAccent(accent: string) {
  return ACCENTS.find((item) => item.id === accent) ?? ACCENTS[0];
}

/** Apply the selected light/dark theme and accent to the whole app. */
export function applyTheme(theme: "dark" | "light", accent: string) {
  const root = document.documentElement;
  const selected = getAccent(accent);

  root.dataset.theme = theme;
  root.dataset.accent = selected.id;

  // Inline custom properties keep all accent-aware components in sync,
  // including components that use CSS utilities, glows and gradients.
  root.style.setProperty("--tcy-accent", selected.color);
  root.style.setProperty("--tcy-accent-deep", selected.deep);
  root.style.setProperty("--tcy-on-accent", selected.onAccent);
  root.style.setProperty("--tcy-glow-1", selected.glow1);
  root.style.setProperty("--tcy-glow-2", selected.glow2);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", theme === "light" ? "#f5f5f7" : "#050506");
  }
}
