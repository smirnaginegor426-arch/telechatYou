import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Check, Mic, Paperclip, Smile, UserRound } from "lucide-react";
import { toast } from "sonner";
import {
  CHAT_WALLPAPERS,
  GLOBAL_CHAT_WALLPAPER_CHANGE_EVENT,
  GLOBAL_CHAT_WALLPAPER_KEY,
  readGlobalChatWallpaper,
  type ChatWallpaperId,
} from "@/lib/chat-wallpapers";

// All built-in wallpapers have a dark variant; no separate light-only wallpapers are offered.
const WALLPAPER_OPTIONS = CHAT_WALLPAPERS;

export default function Wallpapers() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<ChatWallpaperId>(readGlobalChatWallpaper);

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
    toast.success("Обои применены");
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

      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5 px-4 pb-8">
        <section className="w-full">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-extrabold tcy-text">Классические обои</h2>
              <p className="mt-1 text-[11.5px] tcy-faint">Выбери фон · 21 вариант</p>
            </div>
            <span className="shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold tcy-dim" style={{ borderColor: "var(--tcy-selected-accent)" }}>
              Выбрано: {WALLPAPER_OPTIONS.find((item) => item.id === selected)?.name ?? "Обои"}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3">
            {WALLPAPER_OPTIONS.map((item) => {
              const active = selected === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectWallpaper(item.id)}
                  aria-pressed={active}
                  className="tcy-press min-w-0 rounded-[15px] border p-1.5 text-left transition-colors"
                  style={{
                    borderColor: active ? "var(--tcy-selected-accent)" : "var(--tcy-line)",
                    background: active ? "var(--tcy-card-strong)" : "var(--tcy-card)",
                    boxShadow: active ? "0 0 0 1px var(--tcy-selected-accent)" : "none",
                  }}
                >
                  <span className={"tcy-wallpaper-preview tcy-wallpaper-bg--" + item.id + " relative flex h-[68px] w-full items-center justify-center overflow-hidden rounded-[10px]"}>
                    {active && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ background: "rgba(5, 10, 18, .88)", color: "#fff" }}>
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                  </span>
                  <span className="mt-1.5 block truncate px-0.5 text-[11.5px] font-bold tcy-text">{item.name}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="w-full">
          <div className="mb-3">
            <h2 className="text-[15px] font-extrabold tcy-text">Предпросмотр</h2>
            <p className="mt-1 text-[11.5px] tcy-faint">Без переписки — только пользователь, фон и поле ввода</p>
          </div>
          <div
            className={"tcy-wallpaper-bg--" + selected + " relative mx-auto flex h-[360px] w-full max-w-[340px] flex-col overflow-hidden rounded-[25px] border border-white/10 sm:h-[420px]"}
            aria-label="Предпросмотр обоев без сообщений"
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
          <p className="mx-auto mt-2 max-w-[340px] text-center text-[11.5px] leading-relaxed tcy-faint">
            Выбранные обои применяются ко всем чатам без отдельного фона. Если для чата уже заданы свои обои, они сохраняются.
          </p>
        </section>
      </div>
    </div>
  );
}
