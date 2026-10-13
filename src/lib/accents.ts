export const ACCENTS = [
  { id: "mono", name: "Чёрно-белый", color: "#e4e4e7" },
] as const;

export type AccentId = (typeof ACCENTS)[number]["id"];

/**
 * TeleChatYou uses a fixed monochrome black theme.
 * Older saved theme/accent preferences are intentionally ignored.
 */
export function applyTheme(_theme: "dark" | "light", _accent: string) {
  document.documentElement.dataset.theme = "dark";
  document.documentElement.dataset.accent = "mono";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", "#050506");
}
