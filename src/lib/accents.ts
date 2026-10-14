export const ACCENTS = [
  { id: "purple", name: "Фиолетовый", color: "#9b5de5", deep: "#6d28d9", onAccent: "#ffffff", glow1: "rgba(155, 93, 229, 0.24)", glow2: "rgba(59, 130, 246, 0.12)" },
  { id: "blue", name: "Синий", color: "#1685f8", deep: "#075fc5", onAccent: "#ffffff", glow1: "rgba(22, 133, 248, 0.24)", glow2: "rgba(14, 165, 233, 0.12)" },
  { id: "cyan", name: "Бирюзовый", color: "#08abc2", deep: "#087f95", onAccent: "#ffffff", glow1: "rgba(8, 171, 194, 0.24)", glow2: "rgba(6, 182, 212, 0.12)" },
  { id: "green", name: "Зелёный", color: "#10b981", deep: "#047857", onAccent: "#062b20", glow1: "rgba(16, 185, 129, 0.24)", glow2: "rgba(5, 150, 105, 0.12)" },
  { id: "orange", name: "Оранжевый", color: "#ff8a24", deep: "#c65d0a", onAccent: "#1c1004", glow1: "rgba(255, 138, 36, 0.24)", glow2: "rgba(126, 34, 206, 0.12)" },
  { id: "red", name: "Красный", color: "#f43f5e", deep: "#be123c", onAccent: "#ffffff", glow1: "rgba(244, 63, 94, 0.24)", glow2: "rgba(225, 29, 72, 0.12)" },
  { id: "pink", name: "Розовый", color: "#ec4899", deep: "#be185d", onAccent: "#ffffff", glow1: "rgba(236, 72, 153, 0.24)", glow2: "rgba(190, 24, 93, 0.12)" },
] as const;

export type AccentId = (typeof ACCENTS)[number]["id"];

export function getAccent(accent: string) {
  return ACCENTS.find((item) => item.id === accent) ?? ACCENTS[0];
}

/**
 * Each accent is a complete color mood: surfaces, backgrounds, incoming
 * bubbles, glass, focus states and the navigation island are tinted together.
 */
export function applyTheme(theme: "dark" | "light", accent: string) {
  const root = document.documentElement;
  const selected = getAccent(accent);
  const tint = selected.color;

  root.dataset.theme = theme;
  root.dataset.accent = selected.id;

  root.style.setProperty("--tcy-accent", tint);
  root.style.setProperty("--tcy-accent-deep", selected.deep);
  root.style.setProperty("--tcy-on-accent", selected.onAccent);
  root.style.setProperty("--tcy-glow-1", selected.glow1);
  root.style.setProperty("--tcy-glow-2", selected.glow2);

  if (theme === "dark") {
    root.style.setProperty("--tcy-bg", `color-mix(in srgb, ${tint} 25%, #050506)`);
    root.style.setProperty("--tcy-bg-2", `color-mix(in srgb, ${tint} 31%, #09090b)`);
    root.style.setProperty("--tcy-card", `color-mix(in srgb, ${tint} 15%, rgba(12, 12, 18, 0.66))`);
    root.style.setProperty("--tcy-card-strong", `color-mix(in srgb, ${tint} 23%, rgba(12, 12, 18, 0.76))`);
    root.style.setProperty("--tcy-solid", `color-mix(in srgb, ${tint} 22%, #0b0b0d)`);
    root.style.setProperty("--tcy-solid-2", `color-mix(in srgb, ${tint} 28%, #111114)`);
    root.style.setProperty("--tcy-line", `color-mix(in srgb, ${tint} 34%, rgba(244, 244, 245, 0.13))`);
    root.style.setProperty("--tcy-line-strong", `color-mix(in srgb, ${tint} 44%, rgba(244, 244, 245, 0.22))`);
    root.style.setProperty("--tcy-text", `color-mix(in srgb, ${tint} 5%, #f4f4f5)`);
    root.style.setProperty("--tcy-dim", `color-mix(in srgb, ${tint} 17%, #a1a1aa)`);
    root.style.setProperty("--tcy-faint", `color-mix(in srgb, ${tint} 18%, #85858f)`);
    root.style.setProperty("--tcy-bubble-in", `color-mix(in srgb, ${tint} 19%, rgba(20, 20, 26, 0.82))`);
    root.style.setProperty("--tcy-header", `color-mix(in srgb, ${tint} 22%, rgba(5, 5, 8, 0.82))`);
    root.style.setProperty("--tcy-input", `color-mix(in srgb, ${tint} 18%, rgba(8, 8, 14, 0.72))`);
    root.style.setProperty("--tcy-glass-line", `color-mix(in srgb, ${tint} 39%, rgba(255,255,255,.17))`);
  } else {
    root.style.setProperty("--tcy-bg", `color-mix(in srgb, ${tint} 11%, #f5f5f7)`);
    root.style.setProperty("--tcy-bg-2", `color-mix(in srgb, ${tint} 14%, #ededf0)`);
    root.style.setProperty("--tcy-card", `color-mix(in srgb, ${tint} 10%, rgba(255, 255, 255, 0.72))`);
    root.style.setProperty("--tcy-card-strong", `color-mix(in srgb, ${tint} 16%, rgba(255, 255, 255, 0.82))`);
    root.style.setProperty("--tcy-solid", `color-mix(in srgb, ${tint} 8%, #ffffff)`);
    root.style.setProperty("--tcy-solid-2", `color-mix(in srgb, ${tint} 12%, #f4f4f5)`);
    root.style.setProperty("--tcy-line", `color-mix(in srgb, ${tint} 28%, rgba(24, 24, 27, 0.14))`);
    root.style.setProperty("--tcy-line-strong", `color-mix(in srgb, ${tint} 35%, rgba(24, 24, 27, 0.22))`);
    root.style.setProperty("--tcy-text", "#18181b");
    root.style.setProperty("--tcy-dim", `color-mix(in srgb, ${tint} 24%, #52525b)`);
    root.style.setProperty("--tcy-faint", `color-mix(in srgb, ${tint} 15%, #71717a)`);
    root.style.setProperty("--tcy-bubble-in", `color-mix(in srgb, ${tint} 12%, rgba(255, 255, 255, 0.86))`);
    root.style.setProperty("--tcy-header", `color-mix(in srgb, ${tint} 13%, rgba(250, 250, 252, 0.84))`);
    root.style.setProperty("--tcy-input", `color-mix(in srgb, ${tint} 11%, rgba(255, 255, 255, 0.76))`);
    root.style.setProperty("--tcy-glass-line", `color-mix(in srgb, ${tint} 34%, rgba(255,255,255,.72))`);
  }

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#f5f5f7" : selected.deep);
}
