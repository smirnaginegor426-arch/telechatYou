export const ACCENTS = [
  { id: "mono", name: "Чёрно-белый", color: "#e4e4e7" },
] as const;

export type AccentId = (typeof ACCENTS)[number]["id"];

/** Apply a user's selected theme while keeping the app's monochrome accent. */
export function applyTheme(theme: "dark" | "light", _accent: string) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.accent = "mono";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#f5f5f7" : "#050506");
}
