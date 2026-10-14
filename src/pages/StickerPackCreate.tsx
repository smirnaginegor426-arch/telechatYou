import { useRef, useState, type ChangeEvent } from "react";
import { ArrowLeft, Check, Images, Plus, Sticker, X } from "lucide-react";
import { useNavigate } from "react-router";
import { AvatarEditor } from "@/components/AvatarEditor";
import { TcInput } from "@/components/TcInput";
import { compressStickerFile, saveStickerPack, type StickerAsset } from "@/lib/stickers";

const REOPEN_STICKERS_KEY = "tcy-open-stickers-after-create";

export default function StickerPackCreate() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const queuedFiles = useRef<File[]>([]);
  const editorSaved = useRef(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [packName, setPackName] = useState("");
  const [error, setError] = useState("");
  const [editingFile, setEditingFile] = useState<File | null>(null);
  const [stickers, setStickers] = useState<StickerAsset[]>([]);

  const selectGallery = () => {
    setError("");
    inputRef.current?.click();
  };

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    queuedFiles.current = Array.from(event.target.files ?? []).slice(0, 12 - stickers.length);
    event.currentTarget.value = "";
    if (queuedFiles.current.length) {
      setEditingFile(queuedFiles.current.shift() ?? null);
    }
  };

  const finishEditor = () => {
    if (editorSaved.current) {
      editorSaved.current = false;
      setEditingFile(queuedFiles.current.shift() ?? null);
    } else {
      setEditingFile(null);
      queuedFiles.current = [];
    }
  };

  const saveEditedSticker = async (editedFile: File) => {
    const dataUrl = await compressStickerFile(editedFile);
    setStickers((current) => [...current, {
      id: `sticker-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: `Стикер ${current.length + 1}`,
      dataUrl,
      contentType: "image/webp",
    }]);
    editorSaved.current = true;
  };

  const finish = () => {
    const name = packName.trim().slice(0, 48);
    if (!name) {
      setStep(1);
      setError("Введи имя стикер-пака.");
      return;
    }
    if (!stickers.length) {
      setError("Добавь хотя бы один стикер из галереи.");
      return;
    }
    try {
      saveStickerPack({ id: `pack-${Date.now()}`, name, stickers, createdAt: Date.now() });
      sessionStorage.setItem(REOPEN_STICKERS_KEY, "1");
      navigate(-1);
    } catch {
      setError("Не удалось сохранить пак. Возможно, памяти устройства недостаточно.");
    }
  };

  const back = () => {
    if (editingFile) {
      setEditingFile(null);
      queuedFiles.current = [];
      return;
    }
    if (step === 2) setStep(1);
    else {
      sessionStorage.removeItem(REOPEN_STICKERS_KEY);
      navigate(-1);
    }
  };

  return (
    <div className="relative flex h-full flex-col overflow-y-auto no-scrollbar pb-5">
      <header className="flex items-center gap-3 px-5 pt-5 safe-top pb-5">
        <button type="button" onClick={back} className="tcy-press flex h-10 w-10 shrink-0 items-center justify-center rounded-full tcy-card border tcy-line tcy-text" aria-label="Назад">
          <ArrowLeft size={19} />
        </button>
        <div className="flex h-11 w-11 items-center justify-center rounded-[15px]" style={{ background: "color-mix(in srgb, var(--tcy-selected-accent) 15%, var(--tcy-card))", color: "var(--tcy-selected-accent)" }}>
          <Sticker size={22} />
        </div>
        <div className="min-w-0">
          <h1 className="text-[21px] font-extrabold tcy-text">Новый стикер-пак</h1>
          <p className="text-[12px] tcy-dim">Шаг {step} из 2</p>
        </div>
      </header>

      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />

      {step === 1 ? (
        <section className="mx-4 space-y-5 rounded-[27px] border tcy-line tcy-card p-5">
          <div>
            <h2 className="text-[22px] font-black tcy-text">Имя стикер-пака</h2>
            <p className="mt-1.5 text-[13px] tcy-dim">Придумай короткое название — его увидишь в панели стикеров.</p>
          </div>
          <TcInput autoFocus value={packName} onChange={(event) => { setPackName(event.target.value); setError(""); }} maxLength={48} placeholder="Например, Мои стикеры" />
          {error && <p role="alert" className="text-[12px] tcy-danger">{error}</p>}
          <button type="button" onClick={() => {
            if (!packName.trim()) { setError("Введи имя стикер-пака."); return; }
            setError("");
            setStep(2);
          }} className="tcy-press flex h-12 w-full items-center justify-center gap-2 rounded-[17px] tcy-gradient-accent text-[14px] font-extrabold" style={{ color: "var(--tcy-selected-on-accent)" }}>
            Дальше
          </button>
        </section>
      ) : (
        <section className="mx-4 space-y-4 rounded-[27px] border tcy-line tcy-card p-5">
          <div>
            <h2 className="text-[21px] font-black tcy-text">Давай выберем сами стикеры!</h2>
            <p className="mt-1.5 text-[12.5px] tcy-dim">Каждую картинку можно обрезать и украсить в редакторе.</p>
          </div>

          <button type="button" onClick={selectGallery} className="tcy-press flex w-full items-center justify-center gap-2 rounded-[17px] border border-dashed tcy-line tcy-card-strong px-4 py-4 text-[13.5px] font-extrabold tcy-text">
            <Images size={19} /> Открыть галерею
          </button>

          <div className="grid grid-cols-4 gap-2">
            {stickers.map((sticker) => (
              <div key={sticker.id} className="relative aspect-square rounded-[16px] border tcy-line tcy-card p-1.5">
                <img src={sticker.dataUrl} alt={sticker.name} className="h-full w-full object-contain" />
                <button type="button" aria-label="Удалить стикер из пака" onClick={() => setStickers((current) => current.filter((item) => item.id !== sticker.id))} className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full" style={{ background: "var(--tcy-danger)", color: "#fff" }}>
                  <X size={13} />
                </button>
              </div>
            ))}
            {stickers.length < 12 && (
              <button type="button" onClick={selectGallery} className="flex aspect-square items-center justify-center rounded-[16px] border border-dashed tcy-line tcy-faint">
                <Plus size={20} />
              </button>
            )}
          </div>

          <p className="text-[11px] tcy-faint">{stickers.length} из 12 стикеров · Квадратный формат 512 × 512</p>
          {error && <p role="alert" className="text-[12px] tcy-danger">{error}</p>}
          <button type="button" onClick={finish} className="tcy-press flex h-12 w-full items-center justify-center gap-2 rounded-[17px] tcy-gradient-accent text-[14px] font-extrabold" style={{ color: "var(--tcy-selected-on-accent)" }}>
            <Check size={18} /> Готово!
          </button>
        </section>
      )}

      {editingFile && (
        <AvatarEditor
          file={editingFile}
          onCancel={finishEditor}
          onSave={saveEditedSticker}
          title="Редактор стикера"
          subtitle="Обрежь изображение и добавь свои эффекты"
          saveLabel="Готово!"
        />
      )}
    </div>
  );
}
