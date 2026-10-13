export const CHAT_WALLPAPERS = [
  { id: "black", name: "Чёрный", description: "Глубокий чёрный" },
  { id: "graphite", name: "Графит", description: "Тёмный металл" },
  { id: "stars", name: "Звёзды", description: "Ночное небо" },
  { id: "space", name: "Космос", description: "Сине-фиолетовое свечение" },
  { id: "violet", name: "Фиолетовый", description: "Тёмный фиолетовый" },
  { id: "wine", name: "Бордо", description: "Тёплые сумерки" },
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

export const CHAT_WALLPAPER_CHANGE_EVENT = "tcy:chat-wallpaper-change";
