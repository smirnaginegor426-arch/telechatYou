import { useEffect, useRef } from "react";
import { trpc } from "@/providers/trpc";
import {
  readFavoriteStickers,
  readStickerPacks,
  replaceStickerLibrary,
  STICKERS_CHANGED_EVENT,
  type FavoriteSticker,
  type StickerPack,
} from "@/lib/stickers";

function mergePacks(remote: StickerPack[], local: StickerPack[]): StickerPack[] {
  const byId = new Map<string, StickerPack>();
  for (const pack of remote) byId.set(pack.id, pack);
  for (const pack of local) {
    const existing = byId.get(pack.id);
    if (!existing) {
      byId.set(pack.id, pack);
      continue;
    }
    const stickers = new Map(existing.stickers.map((sticker) => [sticker.id, sticker]));
    for (const sticker of pack.stickers) {
      stickers.set(sticker.id, { ...stickers.get(sticker.id), ...sticker });
    }
    byId.set(pack.id, { ...existing, ...pack, stickers: [...stickers.values()] });
  }
  return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
}

function mergeFavorites(remote: FavoriteSticker[], local: FavoriteSticker[]): FavoriteSticker[] {
  const byKey = new Map<string, FavoriteSticker>();
  for (const sticker of [...remote, ...local]) {
    const key = `${sticker.id}|${sticker.attachmentKey ?? ""}|${sticker.dataUrl ?? ""}`;
    byKey.set(key, sticker);
  }
  return [...byKey.values()].slice(-80).reverse();
}

/**
 * Hydrates sticker packs from the signed-in account, merges in legacy local packs,
 * then mirrors any later sticker/favorite changes back to the account row.
 */
export function AccountCollectionsSync() {
  const library = trpc.accountData.stickerLibrary.get.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
  });
  const save = trpc.accountData.stickerLibrary.save.useMutation();
  const hydrated = useRef(false);
  const applyingRemote = useRef(false);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!library.data || hydrated.current) return;
    const remotePacks = library.data.packs as StickerPack[];
    const remoteFavorites = library.data.favorites as FavoriteSticker[];
    const mergedPacks = mergePacks(remotePacks, readStickerPacks());
    const mergedFavorites = mergeFavorites(remoteFavorites, readFavoriteStickers());
    applyingRemote.current = true;
    replaceStickerLibrary(mergedPacks, mergedFavorites);
    applyingRemote.current = false;
    hydrated.current = true;

    if (
      JSON.stringify(remotePacks) !== JSON.stringify(mergedPacks) ||
      JSON.stringify(remoteFavorites) !== JSON.stringify(mergedFavorites)
    ) {
      save.mutate({ packs: mergedPacks, favorites: mergedFavorites });
    }
  }, [library.data, save.mutate]);

  useEffect(() => {
    const sync = () => {
      if (!hydrated.current || applyingRemote.current) return;
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        saveTimer.current = null;
        save.mutate({
          packs: readStickerPacks(),
          favorites: readFavoriteStickers(),
        });
      }, 350);
    };
    window.addEventListener(STICKERS_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(STICKERS_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, [save.mutate]);

  return null;
}
