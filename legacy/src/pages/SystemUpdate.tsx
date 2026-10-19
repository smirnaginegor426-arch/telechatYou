import { useState } from "react";
import { useNavigate } from "react-router";
import { AlertCircle, ArrowLeft, CheckCircle2, Download, KeyRound, RefreshCw, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { TcButton } from "@/components/TcButton";

const APP_VERSION = "2.0.0";



export default function SystemUpdate() {
  const navigate = useNavigate();
  const [checkRequested, setCheckRequested] = useState(false);
  const [showTesterDialog, setShowTesterDialog] = useState(false);
  const [testerKey, setTesterKey] = useState("");
  const [keyError, setKeyError] = useState("");
  const [keyAccepted, setKeyAccepted] = useState(false);
  const [isCheckingKey, setIsCheckingKey] = useState(false);

  const closeTesterDialog = () => {
    setShowTesterDialog(false);
    setTesterKey("");
    setKeyError("");
    setKeyAccepted(false);
  };

  const submitTesterKey = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isCheckingKey) return;

    const normalizedKey = testerKey.trim().toUpperCase();
    setIsCheckingKey(true);
    setKeyError("");
    setKeyAccepted(false);

    try {
      const response = await fetch("/api/alpha/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ key: normalizedKey }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        code?: string;
        error?: string;
        downloadUrl?: string;
      };

      if (!response.ok || !result.ok) {
        setKeyAccepted(false);
        setKeyError(result.error || (result.code === "USED"
          ? "Этот ключ уже использован."
          : "Не удалось проверить ключ. Попробуй ещё раз."));
        return;
      }

      if (!result.downloadUrl) {
        setKeyAccepted(false);
        setKeyError("Ссылка на скачивание временно недоступна.");
        return;
      }

      setKeyAccepted(true);
      window.location.assign(result.downloadUrl);
    } catch {
      setKeyAccepted(false);
      setKeyError("Не удалось связаться с сервером. Проверь интернет и попробуй ещё раз.");
    } finally {
      setIsCheckingKey(false);
    }
  };

  return (
    <div className="relative h-full flex flex-col overflow-y-auto no-scrollbar">
      <header className="relative z-10 flex items-center gap-3 px-4 pt-5 pb-4 safe-top">
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
        <div className="w-24 h-24 rounded-[28px] border tcy-line tcy-card flex items-center justify-center">
          <Logo size={68} />
        </div>

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

        <div className="mt-3 w-full max-w-sm">
          <TcButton
            size="lg"
            variant="soft"
            onClick={() => {
              setTesterKey("");
              setKeyError("");
              setKeyAccepted(false);
              setShowTesterDialog(true);
            }}
          >
            <Download size={17} />
            Скачать
          </TcButton>
        </div>
      </main>

      {showTesterDialog && (
        <div
          className="fixed inset-0 z-[10080] flex items-center justify-center bg-black/55 px-5 py-6 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeTesterDialog();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="tester-alpha-title"
            className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#171717] p-5 text-left text-white shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-[#242424] text-white">
                <KeyRound size={21} />
              </div>
              <div className="min-w-0 flex-1 pr-1">
                <h2 id="tester-alpha-title" className="text-[18px] font-extrabold tcy-text">
                  Альфа версия TeleChat YouV2.0 Только для Тестеров
                </h2>
                <p className="mt-2 text-[13px] leading-5 text-white/60">
                  Введи выданный ключ доступа, чтобы продолжить скачивание тестовой версии.
                </p>
              </div>
              <button
                type="button"
                onClick={closeTesterDialog}
                aria-label="Закрыть"
                className="tcy-press flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#242424] text-white/70"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submitTesterKey} className="mt-5">
              <label htmlFor="tester-alpha-key" className="mb-2 block text-[13px] font-semibold text-white/85">
                Ключ доступа
              </label>
              <input
                id="tester-alpha-key"
                name="tester-alpha-key"
                type="text"
                value={testerKey}
                onChange={(event) => {
                  setTesterKey(event.target.value);
                  setKeyError("");
                  setKeyAccepted(false);
                }}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="Введи ключ доступа"
                className="h-12 w-full rounded-2xl border border-white/15 bg-[#222222] px-4 text-[14px] text-white placeholder:text-white/35 outline-none focus:border-white/40"
                aria-invalid={Boolean(keyError)}
                aria-describedby={keyError ? "tester-alpha-error" : undefined}
              />

              {keyError && (
                <p id="tester-alpha-error" role="alert" className="mt-2 flex items-start gap-2 text-[13px] text-red-400">
                  <AlertCircle size={17} className="mt-0.5 shrink-0" />
                  {keyError}
                </p>
              )}

              {keyAccepted && (
                <div role="status" className="mt-3 rounded-2xl border border-white/10 bg-[#222222] px-3 py-3">
                  <p className="flex items-center gap-2 text-[13px] font-bold text-white">
                    <CheckCircle2 size={17} className="tcy-accent" />
                    Ключ принят
                  </p>
                  <p className="mt-1 text-[12px] leading-5 text-white/60">
                    Начинаем скачивание альфа-версии TeleChat You.
                  </p>
                </div>
              )}

              <div className="mt-5 flex flex-col gap-2">
                <TcButton type="submit" size="lg" disabled={isCheckingKey || !testerKey.trim()}>
                  <KeyRound size={17} />
                  {isCheckingKey ? "Проверяем ключ…" : "Проверить ключ и скачать"}
                </TcButton>
                <TcButton type="button" size="lg" variant="soft" onClick={closeTesterDialog}>
                  Отмена
                </TcButton>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
