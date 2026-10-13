import { useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  BellRing,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { TcButton } from "@/components/TcButton";

const APP_VERSION = "1.0.0";

function formatCheckedAt(date: Date) {
  return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export default function SystemUpdate() {
  const navigate = useNavigate();
  const [lastChecked, setLastChecked] = useState(() => new Date());
  const [notificationVisible, setNotificationVisible] = useState(true);
  const [checking, setChecking] = useState(false);

  const checkForUpdates = () => {
    setChecking(true);
    // The current app does not have a remote release feed yet. This refreshes the
    // installed-version status shown by the client and avoids claiming a server check.
    window.setTimeout(() => {
      setLastChecked(new Date());
      setNotificationVisible(true);
      setChecking(false);
    }, 350);
  };

  return (
    <div className="relative h-full flex flex-col overflow-y-auto no-scrollbar pb-28">
      <header className="relative z-10 flex items-center gap-3 px-4 pt-5 safe-top pb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="tcy-press w-10 h-10 rounded-full tcy-card border tcy-line flex items-center justify-center tcy-dim"
          aria-label="Назад"
        >
          <ArrowLeft size={19} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[20px] font-extrabold tcy-text">Системное обновление</h1>
          <p className="text-[12px] tcy-faint">Версия и состояние приложения</p>
        </div>
        <RefreshCw size={20} className="tcy-accent" />
      </header>

      <main className="relative z-10 flex-1 px-4 space-y-4">
        <section className="relative overflow-hidden rounded-[28px] border tcy-line tcy-solid p-5 text-center">
          <div
            className="absolute inset-x-0 top-0 h-40 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at 50% 0%, var(--tcy-glow-1), transparent 72%)" }}
          />
          <div
            className="relative mx-auto w-[104px] h-[104px] rounded-[30px] flex items-center justify-center border tcy-line tcy-card tcy-shadow-soft"
          >
            <Logo size={76} />
          </div>
          <h2 className="relative mt-4 text-[22px] font-extrabold tcy-text">TeleChatYou</h2>
          <p className="relative mt-1 text-[13px] tcy-dim">Система и обновления</p>
          <div className="relative mt-4 flex justify-center">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-bold border"
              style={{
                borderColor: "color-mix(in srgb, var(--tcy-accent) 40%, transparent)",
                background: "color-mix(in srgb, var(--tcy-accent) 12%, transparent)",
                color: "var(--tcy-accent)",
              }}
            >
              <CheckCircle2 size={14} /> Версия актуальна
            </span>
          </div>
          <div className="relative mt-5 grid grid-cols-2 gap-2">
            <div className="rounded-[17px] tcy-card border tcy-line px-3 py-3">
              <p className="text-[11px] tcy-faint">Текущая версия</p>
              <p className="mt-1 text-[16px] font-extrabold tcy-text">v{APP_VERSION}</p>
            </div>
            <div className="rounded-[17px] tcy-card border tcy-line px-3 py-3">
              <p className="text-[11px] tcy-faint">Тип выпуска</p>
              <p className="mt-1 text-[14px] font-extrabold tcy-text">Стабильный</p>
            </div>
          </div>
        </section>

        {notificationVisible && (
          <section
            aria-live="polite"
            role="status"
            className="rounded-[23px] border tcy-line tcy-card p-4 flex items-start gap-3.5"
          >
            <span className="w-11 h-11 rounded-[15px] tcy-gradient-accent flex items-center justify-center shrink-0" style={{ color: "var(--tcy-on-accent)" }}>
              <BellRing size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.06em] tcy-faint">Системное уведомление</p>
                <span className="text-[10px] tcy-faint shrink-0">Сейчас</span>
              </div>
              <p className="mt-1 text-[14px] font-extrabold tcy-text">У вас последняя версия TeleChatYou!</p>
              <p className="mt-1 text-[12px] leading-relaxed tcy-dim">
                Установленная версия приложения: {APP_VERSION}. Новых сведений об обновлении в приложении пока нет.
              </p>
            </div>
          </section>
        )}

        <section className="rounded-[23px] tcy-card border tcy-line overflow-hidden">
          <div className="px-4 py-3.5 flex items-center gap-3.5">
            <span className="w-9 h-9 rounded-[13px] tcy-card-strong flex items-center justify-center tcy-accent">
              <Smartphone size={17} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-bold tcy-text">Информация о версии</p>
              <p className="mt-0.5 text-[11.5px] tcy-faint">TeleChatYou v{APP_VERSION}</p>
            </div>
            <Check size={17} className="tcy-accent" />
          </div>
          <div className="h-px mx-4" style={{ background: "var(--tcy-line)" }} />
          <div className="px-4 py-3.5 flex items-center gap-3.5">
            <span className="w-9 h-9 rounded-[13px] tcy-card-strong flex items-center justify-center tcy-accent">
              <ShieldCheck size={17} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-bold tcy-text">Канал обновлений</p>
              <p className="mt-0.5 text-[11.5px] tcy-faint">Стабильный выпуск</p>
            </div>
            <ChevronRight size={16} className="tcy-faint" />
          </div>
          <div className="h-px mx-4" style={{ background: "var(--tcy-line)" }} />
          <div className="px-4 py-3.5 flex items-center gap-3.5">
            <span className="w-9 h-9 rounded-[13px] tcy-card-strong flex items-center justify-center tcy-accent">
              <Clock3 size={17} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-bold tcy-text">Последняя проверка</p>
              <p className="mt-0.5 text-[11.5px] tcy-faint">{formatCheckedAt(lastChecked)}</p>
            </div>
          </div>
        </section>

        <TcButton size="lg" onClick={checkForUpdates} loading={checking}>
          <RefreshCw size={17} /> Проверить ещё раз
        </TcButton>

        <p className="px-3 text-center text-[11px] leading-relaxed tcy-faint">
          Информация о версии отображается в приложении. Автоматическая проверка удалённого сервера обновлений пока не подключена.
        </p>
      </main>
    </div>
  );
}
