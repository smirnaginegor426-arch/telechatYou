export const NAVIGATION_TAB_OPTIONS = [
  { to: "/", label: "Чаты" },
  { to: "/contacts", label: "Люди" },
  { to: "/profile", label: "Профиль" },
  { to: "/settings", label: "Настройки" },
] as const;

export type NavigationTabId = (typeof NAVIGATION_TAB_OPTIONS)[number]["to"];

export type NavigationIslandPreferences = {
  order: NavigationTabId[];
  width: number;
};

const STORAGE_KEY = "tcy-navigation-island";
const CHANGE_EVENT = "tcy:navigation-island-preferences";
export const DEFAULT_NAVIGATION_ISLAND_WIDTH = 272;
export const MIN_NAVIGATION_ISLAND_WIDTH = 208;
export const MAX_NAVIGATION_ISLAND_WIDTH = 344;

export const DEFAULT_NAVIGATION_ISLAND_PREFERENCES: NavigationIslandPreferences = {
  order: NAVIGATION_TAB_OPTIONS.map((tab) => tab.to),
  width: DEFAULT_NAVIGATION_ISLAND_WIDTH,
};

export function getNavigationIslandPreferences(): NavigationIslandPreferences {
  if (typeof localStorage === "undefined") return DEFAULT_NAVIGATION_ISLAND_PREFERENCES;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_NAVIGATION_ISLAND_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<NavigationIslandPreferences>;
    const validIds = new Set<string>(NAVIGATION_TAB_OPTIONS.map((tab) => tab.to));
    const savedOrder = Array.isArray(parsed.order)
      ? parsed.order.filter((id): id is NavigationTabId => typeof id === "string" && validIds.has(id))
      : [];
    const order = [...savedOrder, ...NAVIGATION_TAB_OPTIONS.map((tab) => tab.to).filter((id) => !savedOrder.includes(id))];
    const width = typeof parsed.width === "number" && Number.isFinite(parsed.width)
      ? Math.min(MAX_NAVIGATION_ISLAND_WIDTH, Math.max(MIN_NAVIGATION_ISLAND_WIDTH, Math.round(parsed.width)))
      : DEFAULT_NAVIGATION_ISLAND_WIDTH;
    return { order, width };
  } catch {
    return DEFAULT_NAVIGATION_ISLAND_PREFERENCES;
  }
}

export function saveNavigationIslandPreferences(
  preferences: NavigationIslandPreferences,
): void {
  const normalized = {
    order: NAVIGATION_TAB_OPTIONS.map((tab) => tab.to).filter((id) => preferences.order.includes(id)),
    width: Math.min(MAX_NAVIGATION_ISLAND_WIDTH, Math.max(MIN_NAVIGATION_ISLAND_WIDTH, Math.round(preferences.width))),
  } satisfies NavigationIslandPreferences;
  // Make sure future or partially missing tab IDs don't disappear from the navigation.
  const missing = NAVIGATION_TAB_OPTIONS.map((tab) => tab.to).filter((id) => !normalized.order.includes(id));
  normalized.order.push(...missing);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Keep the setting active for this session when storage is unavailable.
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: normalized }));
  }
}

export function subscribeNavigationIslandPreferences(
  callback: (preferences: NavigationIslandPreferences) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const onChange = (event: Event) => {
    const detail = (event as CustomEvent<NavigationIslandPreferences>).detail;
    if (detail) callback(detail);
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}
