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

let memoryPacks: StickerPack[] | null = null;
let memoryFavorites: FavoriteSticker[] | null = null;
let preferMemoryPacks = false;
let preferMemoryFavorites = false;

function notifyChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(STICKERS_CHANGED_EVENT));
}

export function readStickerPacks(): StickerPack[] {
  if (preferMemoryPacks && memoryPacks) return memoryPacks;
  try {
    const raw = localStorage.getItem(PACKS_KEY);
    if (raw) {
      const value = JSON.parse(raw) as unknown;
      if (Array.isArray(value)) {
        memoryPacks = value.filter((pack) => pack && typeof pack.id === "string" && typeof pack.name === "string" && Array.isArray(pack.stickers));
        return memoryPacks;
      }
    } else if (memoryPacks) {
      return memoryPacks;
    }
  } catch {
    if (memoryPacks) return memoryPacks;
  }
  return memoryPacks ?? [];
}

export function saveStickerPack(pack: StickerPack): void {
  const packs = readStickerPacks();
  const index = packs.findIndex((item) => item.id === pack.id);
  if (index >= 0) packs[index] = pack;
  else packs.unshift(pack);
  memoryPacks = packs;
  try {
    localStorage.setItem(PACKS_KEY, JSON.stringify(packs));
    preferMemoryPacks = false;
  } catch {
    preferMemoryPacks = true;
  }
  notifyChanged();
}

/** Cache uploaded sticker keys in the owner's local pack so later sends don't upload them again. */
export function updateStickerPackAttachments(packId: string, uploaded: StickerAsset[]): void {
  const packs = readStickerPacks();
  const index = packs.findIndex((item) => item.id === packId);
  if (index < 0) return;
  const byId = new Map(uploaded.map((sticker) => [sticker.id, sticker]));
  packs[index] = {
    ...packs[index],
    stickers: packs[index].stickers.map((sticker) => {
      const next = byId.get(sticker.id);
      return next?.attachmentKey
        ? { ...sticker, attachmentKey: next.attachmentKey, contentType: next.contentType ?? sticker.contentType }
        : sticker;
    }),
  };
  saveStickerPack(packs[index]);
}

/** Restore the complete remote sticker pack, merging duplicate stickers by key. */
/** Replace the local cache with the merged account library after sign-in. */
export function replaceStickerLibrary(packs: StickerPack[], favorites: FavoriteSticker[]): void {
  memoryPacks = packs;
  memoryFavorites = favorites.slice(0, 80);
  try {
    localStorage.setItem(PACKS_KEY, JSON.stringify(memoryPacks));
    preferMemoryPacks = false;
  } catch {
    preferMemoryPacks = true;
  }
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(memoryFavorites));
    preferMemoryFavorites = false;
  } catch {
    preferMemoryFavorites = true;
  }
  notifyChanged();
}

export function saveSharedStickerPack(name: string, sharedStickers: StickerAsset[]): void {
  const cleanName = name.trim().slice(0, 48) || "Сохранённые стикеры";
  const packs = readStickerPacks();
  let pack = packs.find((item) => item.name.toLowerCase() === cleanName.toLowerCase());
  if (!pack) {
    pack = { id: `received-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: cleanName, stickers: [], createdAt: Date.now() };
    packs.unshift(pack);
  }
  const merged = [...pack.stickers];
  for (const sticker of sharedStickers) {
    if (!sticker.attachmentKey) continue;
    const found = merged.findIndex((item) =>
      item.attachmentKey === sticker.attachmentKey || item.id === sticker.id
    );
    if (found >= 0) {
      merged[found] = { ...merged[found], ...sticker };
    } else {
      merged.push(sticker);
    }
  }
  pack.stickers = merged.slice(0, 40);
  saveStickerPack(pack);
}

export function readFavoriteStickers(): FavoriteSticker[] {
  if (preferMemoryFavorites && memoryFavorites) return memoryFavorites;
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (raw) {
      const value = JSON.parse(raw) as unknown;
      if (Array.isArray(value)) {
        memoryFavorites = value.filter((sticker) => sticker && typeof sticker.id === "string");
        return memoryFavorites;
      }
    } else if (memoryFavorites) {
      return memoryFavorites;
    }
  } catch {
    if (memoryFavorites) return memoryFavorites;
  }
  return memoryFavorites ?? [];
}

export function saveFavoriteSticker(sticker: FavoriteSticker): void {
  const favorites = readFavoriteStickers();
  if (!favorites.some((item) => item.id === sticker.id && item.attachmentKey === sticker.attachmentKey && item.dataUrl === sticker.dataUrl)) {
    favorites.unshift(sticker);
    memoryFavorites = favorites.slice(0, 80);
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(memoryFavorites));
      preferMemoryFavorites = false;
    } catch {
      preferMemoryFavorites = true;
    }
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
