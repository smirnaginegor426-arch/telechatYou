export const ACCENTS = [
  { id: "mint", name: "Мята", color: "#2fe0a8" },
  { id: "lagoon", name: "Лагуна", color: "#2dd4bf" },
  { id: "sky", name: "Небо", color: "#4cc3f7" },
  { id: "violet", name: "Фиалка", color: "#b39dfa" },
  { id: "amber", name: "Янтарь", color: "#fbbf24" },
  { id: "rose", name: "Роза", color: "#fb8ba0" },
] as const;

export type AccentId = (typeof ACCENTS)[number]["id"];

export function applyTheme(theme: "dark" | "light", accent: string) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.accent = accent;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#07110e" : "#edf3f0");
}
