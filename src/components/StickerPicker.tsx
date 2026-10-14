import { useEffect, useState } from "react";
import { ChevronLeft, Plus, Sticker, Star, X } from "lucide-react";
import { motion } from "framer-motion";
import { useFileUrl } from "@/hooks/useFileUrl";
import {
  readFavoriteStickers,
  readStickerPacks,
  STICKERS_CHANGED_EVENT,
  type FavoriteSticker,
  type StickerAsset,
  type StickerPack,
} from "@/lib/stickers";

function StickerImage({ sticker, className = "" }: { sticker: StickerAsset; className?: string }) {
  const remoteUrl = useFileUrl(sticker.attachmentKey ?? null);
  const src = sticker.dataUrl ?? remoteUrl;
  return src ? (
    <img src={src} alt={sticker.name} loading="lazy" className={className} draggable={false} />
  ) : (
    <span className="flex items-center justify-center text-[11px] tcy-faint"><Sticker size={18} /></span>
  );
}

export function StickerPicker({
  onSelect,
  onCreatePack,
  onClose,
}: {
  onSelect: (sticker: StickerAsset, packName: string) => void;
  onCreatePack: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"packs" | "favorites">("packs");
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [packs, setPacks] = useState<StickerPack[]>(() => readStickerPacks());
  const [favorites, setFavorites] = useState<FavoriteSticker[]>(() => readFavoriteStickers());

  useEffect(() => {
    const refresh = () => {
      setPacks(readStickerPacks());
      setFavorites(readFavoriteStickers());
    };
    window.addEventListener(STICKERS_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(STICKERS_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const selectedPack = packs.find((pack) => pack.id === selectedPackId) ?? null;
  const items = tab === "favorites"
    ? favorites.map((sticker) => ({ sticker, packName: sticker.packName }))
    : selectedPack
      ? selectedPack.stickers.map((sticker) => ({ sticker, packName: selectedPack.name }))
      : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 7, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 440, damping: 34 }}
      className="tcy-sticker-panel absolute bottom-[76px] left-3 right-3 z-40 overflow-hidden rounded-[23px] border tcy-line tcy-solid tcy-shadow-soft"
      role="dialog"
      aria-label="Стикеры"
    >
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        {selectedPack && tab === "packs" ? (
          <button type="button" onClick={() => setSelectedPackId(null)} aria-label="К списку стикер-паков" className="tcy-press flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] tcy-card tcy-dim">
            <ChevronLeft size={19} />
          </button>
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-[13px]" style={{ background: "color-mix(in srgb, var(--tcy-selected-accent) 14%, var(--tcy-card))", color: "var(--tcy-selected-accent)" }}>
            <Sticker size={19} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-extrabold tcy-text">{selectedPack && tab === "packs" ? selectedPack.name : "Стикеры"}</p>
          <p className="text-[10.5px] tcy-faint">{selectedPack && tab === "packs" ? `${selectedPack.stickers.length} стикеров в паке` : "Твои паки и избранное"}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Закрыть панель" className="tcy-press flex h-8 w-8 items-center justify-center rounded-full tcy-card tcy-dim">
          <X size={16} />
        </button>
      </div>

      <div className="flex gap-1 px-3 pb-2">
        <button type="button" onClick={() => setTab("packs")} className="flex-1 rounded-full py-2 text-[11.5px] font-extrabold" style={{ background: tab === "packs" ? "color-mix(in srgb, var(--tcy-selected-accent) 16%, var(--tcy-card))" : "transparent", color: tab === "packs" ? "var(--tcy-selected-accent)" : "var(--tcy-dim)" }}>Стикер-паки</button>
        <button type="button" onClick={() => setTab("favorites")} className="flex-1 rounded-full py-2 text-[11.5px] font-extrabold" style={{ background: tab === "favorites" ? "color-mix(in srgb, var(--tcy-selected-accent) 16%, var(--tcy-card))" : "transparent", color: tab === "favorites" ? "var(--tcy-selected-accent)" : "var(--tcy-dim)" }}>
          <Star size={12} className="mr-1 inline-block" /> Избранное
        </button>
      </div>

      <div className="tcy-sticker-grid max-h-[205px] overflow-y-auto px-3 pb-3">
        {tab === "packs" && !selectedPack && (
          <>
            <button type="button" onClick={onCreatePack} className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-[17px] border border-dashed tcy-line tcy-card tcy-press" aria-label="Создать стикер-пак">
              <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: "color-mix(in srgb, var(--tcy-selected-accent) 17%, var(--tcy-card))", color: "var(--tcy-selected-accent)" }}><Plus size={22} /></span>
              <span className="text-[10px] font-extrabold tcy-dim">Создать</span>
            </button>
            {packs.map((pack) => (
              <button
                type="button"
                key={pack.id}
                onClick={() => setSelectedPackId(pack.id)}
                className="tcy-press flex aspect-square min-w-0 flex-col items-center justify-center gap-1 rounded-[16px] p-1.5 hover:bg-[color:var(--tcy-card-strong)]"
                aria-label={`Открыть стикер-пак ${pack.name}`}
                title={pack.name}
              >
                <span className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden rounded-[11px]">
                  {pack.stickers[0] ? <StickerImage sticker={pack.stickers[0]} className="h-full w-full object-contain" /> : <Sticker size={22} className="tcy-faint" />}
                </span>
                <span className="w-full truncate text-center text-[9px] font-extrabold tcy-dim">{pack.name}</span>
              </button>
            ))}
          </>
        )}
        {items.map(({ sticker, packName }) => (
          <button
            type="button"
            key={`${packName}-${sticker.id}-${sticker.attachmentKey ?? sticker.dataUrl ?? ""}`}
            onClick={() => { onSelect(sticker, packName); onClose(); }}
            className="tcy-press aspect-square min-w-0 rounded-[16px] p-1.5 hover:bg-[color:var(--tcy-card-strong)]"
            title={packName}
            aria-label={`Отправить стикер из ${packName}`}
          >
            <StickerImage sticker={sticker} className="h-full w-full object-contain" />
          </button>
        ))}
      </div>
      {tab === "favorites" && items.length === 0 && (
        <p className="px-5 pb-4 text-center text-[11.5px] tcy-faint">Пока нет избранных стикеров</p>
      )}
      {tab === "packs" && selectedPack && items.length === 0 && (
        <p className="px-5 pb-4 text-center text-[11.5px] tcy-faint">В этом паке пока нет стикеров</p>
      )}
      {tab === "packs" && !selectedPack && packs.length === 0 && (
        <p className="px-5 pb-4 text-center text-[11.5px] tcy-faint">Нажми на плюс, чтобы создать свой стикер-пак</p>
      )}
    </motion.div>
  );
}
