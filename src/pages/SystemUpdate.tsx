import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, CheckCircle2, RefreshCw } from "lucide-react";
import { Logo } from "@/components/Logo";
import { TcButton } from "@/components/TcButton";
import { useExperimentalUI } from "@/hooks/useExperimentalUI";

const APP_VERSION = "1.0.0";

export default function SystemUpdate() {
  const navigate = useNavigate();
  const [checkRequested, setCheckRequested] = useState(false);
  const { enabled: experimentalUI } = useExperimentalUI();

  return (
    <div className="h-full flex flex-col overflow-y-auto no-scrollbar">
      <header className="flex items-center gap-3 px-4 pt-5 pb-4 safe-top">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="tcy-press w-10 h-10 rounded-full tcy-card border tcy-line flex items-center justify-center tcy-dim"
          aria-label="Назад"
        >
          <ArrowLeft size={19} />
        </button>
        <h1 className="text-[20px] font-extrabold tcy-text">Системное обновление</h1>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-12 text-center">
        {experimentalUI ? (
          <div className="h-[132px] w-[132px] overflow-hidden rounded-[32px] tcy-shadow-accent">
            <img
              src="/onboarding/telechatyou-logo.webp"
              alt="TeleChatYou"
              width={132}
              height={132}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="w-24 h-24 rounded-[28px] border tcy-line tcy-card flex items-center justify-center">
            <Logo size={68} />
          </div>
        )}

        <h2 className="mt-5 text-[25px] font-extrabold tcy-text">TeleChatYou</h2>
        <p className="mt-1 text-[14px] tcy-dim">Версия {APP_VERSION}</p>

        <div className="mt-7 w-full max-w-sm rounded-2xl border tcy-line tcy-card px-4 py-4 flex items-center gap-3 text-left">
          <CheckCircle2 size={24} className="tcy-accent shrink-0" />
          <div>
            <p className="text-[14px] font-bold tcy-text">Приложение установлено</p>
            <p className="mt-1 text-[12px] tcy-dim">
              {checkRequested
                ? "Онлайн-проверка обновлений пока не подключена."
                : "Установлена версия " + APP_VERSION + "."}
            </p>
          </div>
        </div>

        <div className="mt-5 w-full max-w-sm">
          <TcButton size="lg" onClick={() => setCheckRequested(true)}>
            <RefreshCw size={17} />
            Проверить обновления
          </TcButton>
        </div>
      </main>
    </div>
  );
}
