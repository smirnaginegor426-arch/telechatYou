import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, ArrowRight, Mic, Paperclip, Smile, UserRound } from "lucide-react";
import { toast } from "sonner";
import {
  CHAT_WALLPAPERS,
  GLOBAL_CHAT_WALLPAPER_CHANGE_EVENT,
  GLOBAL_CHAT_WALLPAPER_KEY,
  readGlobalChatWallpaper,
  type ChatWallpaperId,
} from "@/lib/chat-wallpapers";

const GENERATED_WALLPAPER_IDS = ["generated-1", "generated-2", "generated-3"] as const;
const WALLPAPER_OPTIONS = GENERATED_WALLPAPER_IDS.map((id) => CHAT_WALLPAPERS.find((item) => item.id === id)!).filter(Boolean);

export default function Wallpapers() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<ChatWallpaperId>(() => {
    const saved = readGlobalChatWallpaper();
    return GENERATED_WALLPAPER_IDS.includes(saved as (typeof GENERATED_WALLPAPER_IDS)[number])
      ? saved
      : "generated-1";
  });

  useEffect(() => {
    const saved = readGlobalChatWallpaper();
    if (GENERATED_WALLPAPER_IDS.includes(saved as (typeof GENERATED_WALLPAPER_IDS)[number])) return;
    try {
      window.localStorage.setItem(GLOBAL_CHAT_WALLPAPER_KEY, selected);
    } catch {
      // The visible preview still works if local storage is unavailable.
    }
    window.dispatchEvent(
      new CustomEvent(GLOBAL_CHAT_WALLPAPER_CHANGE_EVENT, { detail: { wallpaper: selected } }),
    );
    // Migrate an older wallpaper selection to the first generated wallpaper once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectWallpaper = (wallpaper: ChatWallpaperId) => {
    try {
      window.localStorage.setItem(GLOBAL_CHAT_WALLPAPER_KEY, wallpaper);
    } catch {
      toast.error("Не удалось сохранить обои в браузере.");
      return;
    }

    setSelected(wallpaper);
    window.dispatchEvent(
      new CustomEvent(GLOBAL_CHAT_WALLPAPER_CHANGE_EVENT, { detail: { wallpaper } }),
    );
  };

  const selectedIndex = Math.max(0, WALLPAPER_OPTIONS.findIndex((item) => item.id === selected));
  const selectedWallpaper = WALLPAPER_OPTIONS[selectedIndex] ?? WALLPAPER_OPTIONS[0];
  const moveWallpaper = (direction: -1 | 1) => {
    const nextIndex = (selectedIndex + direction + WALLPAPER_OPTIONS.length) % WALLPAPER_OPTIONS.length;
    const next = WALLPAPER_OPTIONS[nextIndex];
    if (next) selectWallpaper(next.id);
  };

  return (
    <div className="tcy-settings-page relative h-full overflow-y-auto no-scrollbar pb-32">
      <header className="relative z-10 flex items-center gap-3 px-5 pt-5 safe-top pb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Назад"
          className="tcy-press flex h-10 w-10 shrink-0 items-center justify-center rounded-full tcy-card border tcy-line tcy-dim"
        >
          <ArrowLeft size={19} />
        </button>
        <div className="min-w-0">
          <h1 className="text-[22px] font-extrabold tcy-text">Обои</h1>
          <p className="text-[12.5px] tcy-faint">Тёмные фоны для чатов</p>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-4 px-4 pb-8">
        <p className="text-center text-[12px] leading-relaxed tcy-faint">
          Тёмные обои, созданные для TeleChatYou. Переключай варианты стрелками.
        </p>

        <div
          className={"tcy-wallpaper-bg--" + selectedWallpaper.id + " relative mx-auto flex h-[min(62vh,620px)] min-h-[390px] w-full max-w-[360px] flex-col overflow-hidden rounded-[26px] border border-white/10"}
          aria-label="Предпросмотр обоев без переписки"
        >
          <div className="relative z-10 flex shrink-0 items-center gap-2.5 border-b border-white/10 px-3 py-3" style={{ background: "rgba(7, 13, 23, .78)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10" style={{ background: "#22334d", color: "#eaf2ff" }}>
              <UserRound size={21} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-bold text-white">Пользователь</div>
              <div className="mt-0.5 text-[11px]" style={{ color: "#a5bbd9" }}>был(а) недавно</div>
            </div>
            <span className="flex h-8 w-8 items-center justify-center rounded-full text-white/80">
              <UserRound size={17} />
            </span>
          </div>

          <div className="relative z-0 flex-1" aria-hidden="true" />

          <div className="relative z-10 shrink-0 p-3" style={{ background: "linear-gradient(180deg, transparent, rgba(3, 8, 16, .22))" }}>
            <div className="flex items-center gap-2 rounded-[25px] border border-white/10 px-3 py-2.5" style={{ background: "rgba(10, 18, 31, .93)", color: "#a9bbd3", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
              <Paperclip size={19} className="shrink-0" />
              <span className="flex-1 text-[13px]">Сообщение</span>
              <Smile size={20} className="shrink-0" />
              <Mic size={19} className="shrink-0" />
            </div>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-[360px] items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => moveWallpaper(-1)}
            aria-label="Предыдущие обои"
            title="Предыдущие обои"
            className="tcy-press flex h-12 w-12 shrink-0 items-center justify-center rounded-full border tcy-card-strong tcy-text"
            style={{ borderColor: "var(--tcy-line)" }}
          >
            <ArrowLeft size={21} />
          </button>

          <div className="min-w-0 flex-1 text-center">
            <div className="truncate text-[14px] font-extrabold tcy-text">{selectedWallpaper.name}</div>
            <div className="mt-1 text-[11.5px] tcy-faint">{selectedIndex + 1} / {WALLPAPER_OPTIONS.length}</div>
          </div>

          <button
            type="button"
            onClick={() => moveWallpaper(1)}
            aria-label="Следующие обои"
            title="Следующие обои"
            className="tcy-press flex h-12 w-12 shrink-0 items-center justify-center rounded-full border tcy-card-strong tcy-text"
            style={{ borderColor: "var(--tcy-line)" }}
          >
            <ArrowRight size={21} />
          </button>
        </div>

        <p className="mx-auto max-w-[360px] text-center text-[11.5px] leading-relaxed tcy-faint">
          Обои применяются ко всем чатам без отдельного фона. Индивидуальные обои чатов не меняются.
        </p>
      </div>
    </div>
  );
}
