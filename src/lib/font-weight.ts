export const FONT_WEIGHT_STORAGE_KEY = "tcy-font-weight";
export const DEFAULT_FONT_WEIGHT = 750;

export function normalizeFontWeight(value: number | string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_FONT_WEIGHT;
  return Math.max(100, Math.min(900, Math.round(parsed / 50) * 50));
}

export function getSavedFontWeight(): number {
  try {
    const saved = localStorage.getItem(FONT_WEIGHT_STORAGE_KEY);
    return saved === null ? DEFAULT_FONT_WEIGHT : normalizeFontWeight(saved);
  } catch {
    return DEFAULT_FONT_WEIGHT;
  }
}

export function applyFontWeight(value: number): number {
  const weight = normalizeFontWeight(value);
  const root = document.documentElement;
  root.style.setProperty("--tcy-font-weight", String(weight));
  root.style.setProperty("--tcy-font-weight-heading", String(Math.min(900, weight + 150)));
  return weight;
}
