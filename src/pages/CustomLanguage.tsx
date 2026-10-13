import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Download, Plus, RotateCcw, Save, Trash2, Upload } from "lucide-react";
import { TcButton } from "@/components/TcButton";
import { TcInput } from "@/components/TcInput";
import {
  DEFAULT_LANGUAGE_ENTRIES,
  loadCustomLanguageEntries,
  saveCustomLanguageEntries,
  type CustomLanguageEntry,
} from "@/lib/custom-language";

export default function CustomLanguage() {
  const navigate = useNavigate();
  const importRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<CustomLanguageEntry[]>(DEFAULT_LANGUAGE_ENTRIES);
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = loadCustomLanguageEntries();
    if (stored.length) setEntries(stored);
  }, []);

  const changeEntry = (index: number, field: keyof CustomLanguageEntry, value: string) => {
    setEntries((current) => current.map((entry, i) => i === index ? { ...entry, [field]: value } : entry));
    setSaved(false);
    setNotice("");
  };

  const save = () => {
    try {
      saveCustomLanguageEntries(entries);
      setSaved(true);
      setNotice("Готово! Ваш язык сохранён на этом устройстве.");
    } catch {
      setSaved(false);
      setNotice("Не удалось сохранить язык. Проверьте свободное место в браузере.");
    }
  };

  const addEntry = () => {
    setEntries((current) => [...current, { source: "", translation: "" }]);
    setSaved(false);
    setNotice("");
  };

  const exportLanguage = () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "telechatyou-custom-language.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const importLanguage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!Array.isArray(parsed) || parsed.some((entry) =>
        !entry || typeof entry.source !== "string" || typeof entry.translation !== "string"
      )) throw new Error("invalid");
      setEntries(parsed as CustomLanguageEntry[]);
      setSaved(false);
      setNotice("Файл загружен. Нажмите «Сохранить язык», чтобы применить изменения.");
    } catch {
      setNotice("Не удалось прочитать файл. Выберите JSON, экспортированный из TeleChatYou.");
    }
  };

  const resetDefaults = () => {
    setEntries(DEFAULT_LANGUAGE_ENTRIES.map((entry) => ({ ...entry })));
    setSaved(false);
    setNotice("Список фраз восстановлен. Сохраните его, чтобы применить.");
  };

  return (
    <div className="relative h-full overflow-y-auto no-scrollbar pb-32" data-no-translate="true">
      <header className="sticky top-0 z-20 tcy-header-blur border-b tcy-line px-4 pt-3 pb-3 safe-top">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="tcy-press w-10 h-10 rounded-full tcy-card flex items-center justify-center tcy-dim" aria-label="Назад">
            <ArrowLeft size={19} />
          </button>
          <div className="min-w-0">
            <h1 className="text-[21px] font-extrabold tcy-text">Мой язык</h1>
            <p className="text-[12px] tcy-faint">Свой язык для интерфейса</p>
          </div>
        </div>
      </header>
      <div className="px-4 pt-4 space-y-4">
        <div className="rounded-[22px] tcy-card border tcy-line p-4 space-y-2">
          <p className="text-[13.5px] font-bold tcy-text">Настройте подписи под себя</p>
          <p className="text-[12.5px] leading-relaxed tcy-dim">
            В первой колонке укажите фразу, как она написана в TeleChatYou, во второй — свой вариант.
            После сохранения подходящие подписи, подсказки и кнопки заменятся во всём интерфейсе.
            Сообщения в переписке и текст, который вы вводите, не изменяются.
          </p>
          <p className="text-[11.5px] tcy-faint">Словарь хранится на этом устройстве. Его можно экспортировать и перенести на другое.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <TcButton size="sm" onClick={save}><Save size={15} /> {saved ? "Сохранено" : "Сохранить язык"}</TcButton>
          <TcButton size="sm" variant="soft" onClick={addEntry}><Plus size={15} /> Добавить фразу</TcButton>
          <TcButton size="sm" variant="soft" onClick={exportLanguage}><Download size={15} /> Экспорт</TcButton>
          <TcButton size="sm" variant="soft" onClick={() => importRef.current?.click()}><Upload size={15} /> Импорт</TcButton>
          <TcButton size="sm" variant="soft" onClick={resetDefaults}><RotateCcw size={15} /> Сбросить список</TcButton>
          <input ref={importRef} className="hidden" type="file" accept="application/json,.json" onChange={importLanguage} />
        </div>
        {notice && <p role="status" className="rounded-[14px] tcy-card border tcy-line px-3 py-2 text-[12px] tcy-dim">{notice}</p>}
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[14px] font-bold tcy-text">Фразы интерфейса</h2>
          <span className="text-[11px] tcy-faint">{entries.length} строк</span>
        </div>
        <div className="space-y-3">
          {entries.map((entry, index) => (
            <div key={index} className="rounded-[18px] tcy-card border tcy-line p-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="flex-1 text-[10.5px] font-bold uppercase tracking-wider tcy-faint">Исходная фраза</span>
                <button type="button" aria-label="Удалить фразу" onClick={() => {
                  setEntries((current) => current.filter((_, i) => i !== index));
                  setSaved(false);
                  setNotice("");
                }} className="tcy-press w-8 h-8 rounded-full flex items-center justify-center tcy-faint">
                  <Trash2 size={14} />
                </button>
              </div>
              <TcInput value={entry.source} onChange={(event) => changeEntry(index, "source", event.target.value)} placeholder="Например: Чаты" maxLength={180} />
              <label className="block space-y-1.5">
                <span className="block text-[10.5px] font-bold uppercase tracking-wider tcy-faint">Ваш вариант</span>
                <TcInput value={entry.translation} onChange={(event) => changeEntry(index, "translation", event.target.value)} placeholder="Напишите перевод или своё название" maxLength={180} />
              </label>
            </div>
          ))}
        </div>
        <TcButton size="lg" onClick={save}><Save size={17} /> Сохранить язык</TcButton>
      </div>
    </div>
  );
}
