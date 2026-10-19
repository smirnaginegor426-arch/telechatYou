export const ACCENTS = [
  { id: "mint", name: "Мята", color: "#2fe0a8" },
  { id: "lagoon", name: "Лагуна", color: "#2dd4bf" },
  { id: "sky", name: "Небо", color: "#4cc3f7" },
  { id: "violet", name: "Фиалка", color: "#b39dfa" },
  { id: "amber", name: "Янтарь", color: "#fbbf24" },
  { id: "rose", name: "Роза", color: "#fb8ba0" },
] as const;

export type AccentId = (typeof ACCENTS)[number]["id"];

/**
 * The accent is stored in localStorage under a key shared with every build of
 * the app, so it can hold a palette this build does not know (for example a
 * newer palette saved before the older build was frozen). Unknown names fall
 * back to the default instead of leaving the accent variables unset.
 */
export function resolveAccent(accent: string): AccentId {
  return ACCENTS.some((item) => item.id === accent) ? (accent as AccentId) : "mint";
}

export function applyTheme(theme: "dark" | "light", accent: string) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.accent = resolveAccent(accent);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#07110e" : "#edf3f0");
}
