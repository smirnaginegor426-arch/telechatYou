export const CHAT_WALLPAPERS = [
  { id: "black", name: "Чёрный", description: "Глубокий чёрный" },
  { id: "graphite", name: "Графит", description: "Тёмный металл" },
  { id: "stars", name: "Звёзды", description: "Ночное небо" },
  { id: "space", name: "Космос", description: "Сине-фиолетовое свечение" },
  { id: "violet", name: "Фиолетовый", description: "Тёмный фиолетовый" },
  { id: "wine", name: "Бордо", description: "Тёплые сумерки" },
  { id: "sand", name: "Песок", description: "Классический песочный" },
  { id: "sage", name: "Шалфей", description: "Классический зелёный" },
  { id: "ocean", name: "Океан", description: "Классический синий" },
  { id: "plum", name: "Слива", description: "Классический сливовый" },
  { id: "rose", name: "Роза", description: "Классический розовый" },
  { id: "slate", name: "Сланец", description: "Классический серо-синий" },
  { id: "mint", name: "Мята", description: "Классический мятный" },
  { id: "cocoa", name: "Какао", description: "Классический кофейный" },
  { id: "pattern-sky", name: "Небо", description: "Узор как в Telegram" },
  { id: "pattern-emerald", name: "Изумруд", description: "Узор как в Telegram" },
  { id: "pattern-lavender", name: "Лаванда", description: "Узор как в Telegram" },
  { id: "pattern-sunset", name: "Закат", description: "Узор как в Telegram" },
  { id: "pattern-coral", name: "Коралл", description: "Узор как в Telegram" },
  { id: "pattern-teal", name: "Бирюза", description: "Узор как в Telegram" },
] as const;

export type ChatWallpaperId = (typeof CHAT_WALLPAPERS)[number]["id"];

export const DEFAULT_CHAT_WALLPAPER: ChatWallpaperId = "black";

export function chatWallpaperKey(chatId: number) {
  return `tcy-chat-wallpaper:${chatId}`;
}

export function chatWallpaperImageKey(chatId: number) {
  return `tcy-chat-wallpaper-image:${chatId}`;
}

export function isChatWallpaperId(value: string | null): value is ChatWallpaperId {
  return CHAT_WALLPAPERS.some((wallpaper) => wallpaper.id === value);
}

/**
 * Wallpapers introduced by the private experimental refresh. They stay hidden
 * from the wallpaper picker for accounts that are not the configured tester,
 * so only that account can select (and therefore display) them.
 */
const EXPERIMENTAL_WALLPAPER_IDS: ReadonlySet<string> = new Set([
  "sand",
  "sage",
  "ocean",
  "plum",
  "rose",
  "slate",
  "mint",
  "cocoa",
  "pattern-sky",
  "pattern-emerald",
  "pattern-lavender",
  "pattern-sunset",
  "pattern-coral",
  "pattern-teal",
]);

export function isExperimentalWallpaper(id: string): boolean {
  return EXPERIMENTAL_WALLPAPER_IDS.has(id);
}

export const CHAT_WALLPAPER_CHANGE_EVENT = "tcy:chat-wallpaper-change";
