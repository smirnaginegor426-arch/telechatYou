export const ACCENTS = [
  { id: "mono", name: "Чёрно-белый", color: "#e4e4e7" },
  { id: "halloween", name: "Хэллоуин", color: "#ff8a24" },
] as const;

export type AccentId = (typeof ACCENTS)[number]["id"];

/** Apply the selected light/dark theme with the requested supported accent. */
export function applyTheme(theme: "dark" | "light", accent: string) {
  const activeAccent = accent === "halloween" ? "halloween" : "mono";
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.accent = activeAccent;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const color =
      activeAccent === "halloween"
        ? theme === "light" ? "#fff7ed" : "#130b04"
        : theme === "light" ? "#f5f5f7" : "#050506";
    meta.setAttribute("content", color);
  }
}
