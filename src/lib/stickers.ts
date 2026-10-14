export type StickerAsset = {
  id: string;
  name: string;
  dataUrl?: string;
  attachmentKey?: string;
  contentType?: string;
};

export type StickerPack = {
  id: string;
  name: string;
  stickers: StickerAsset[];
  createdAt: number;
};

export type FavoriteSticker = StickerAsset & { packName: string };

const PACKS_KEY = "tcy-sticker-packs-v1";
const FAVORITES_KEY = "tcy-favorite-stickers-v1";
export const STICKERS_CHANGED_EVENT = "tcy-stickers-changed";

function safeParse<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function notifyChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(STICKERS_CHANGED_EVENT));
}

export function readStickerPacks(): StickerPack[] {
  const value = safeParse<StickerPack[]>(PACKS_KEY, []);
  return Array.isArray(value)
    ? value.filter((pack) => pack && typeof pack.id === "string" && typeof pack.name === "string" && Array.isArray(pack.stickers))
    : [];
}

export function saveStickerPack(pack: StickerPack): void {
  const packs = readStickerPacks();
  const index = packs.findIndex((item) => item.id === pack.id);
  if (index >= 0) packs[index] = pack;
  else packs.unshift(pack);
  localStorage.setItem(PACKS_KEY, JSON.stringify(packs));
  notifyChanged();
}

export function readFavoriteStickers(): FavoriteSticker[] {
  const value = safeParse<FavoriteSticker[]>(FAVORITES_KEY, []);
  return Array.isArray(value) ? value.filter((sticker) => sticker && typeof sticker.id === "string") : [];
}

export function saveFavoriteSticker(sticker: FavoriteSticker): void {
  const favorites = readFavoriteStickers();
  if (!favorites.some((item) => item.id === sticker.id && item.attachmentKey === sticker.attachmentKey && item.dataUrl === sticker.dataUrl)) {
    favorites.unshift(sticker);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites.slice(0, 80)));
    notifyChanged();
  }
}

export function addStickerToPack(packName: string, sticker: StickerAsset): void {
  const cleanName = packName.trim().slice(0, 48) || "Сохранённые стикеры";
  const packs = readStickerPacks();
  let pack = packs.find((item) => item.name.toLowerCase() === cleanName.toLowerCase());
  if (!pack) {
    pack = { id: `saved-${Date.now()}`, name: cleanName, stickers: [], createdAt: Date.now() };
    packs.unshift(pack);
  }
  if (!pack.stickers.some((item) => item.id === sticker.id && item.attachmentKey === sticker.attachmentKey)) {
    pack.stickers = [...pack.stickers, sticker].slice(0, 40);
  }
  saveStickerPack(pack);
}

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Не удалось прочитать изображение"));
    reader.onerror = () => reject(new Error("Не удалось прочитать изображение"));
    reader.readAsDataURL(file);
  });
}

export async function compressStickerFile(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Не удалось открыть редактор стикера");
    context.clearRect(0, 0, 512, 512);
    context.drawImage(bitmap, 0, 0, 512, 512);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.78));
    if (!blob) throw new Error("Не удалось подготовить стикер");
    return await fileToDataUrl(blob);
  } finally {
    bitmap.close();
  }
}
