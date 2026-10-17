import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, FileArchive, RefreshCw } from "lucide-react";
import { Logo } from "@/components/Logo";
import { TcButton } from "@/components/TcButton";

const APP_VERSION = "1.0.0";

type UpdateManifest = {
  released: boolean;
  latestVersion?: string;
  fileName?: string;
  downloadUrl?: string;
  releaseNotes?: string;
};

type CheckState = "loading" | "ready" | "error";

export default function SystemUpdate() {
  const navigate = useNavigate();
  const [manifest, setManifest] = useState<UpdateManifest | null>(null);
  const [checkState, setCheckState] = useState<CheckState>("loading");
  const [downloadStarted, setDownloadStarted] = useState(false);

  const checkForUpdates = useCallback(async () => {
    setCheckState("loading");
    try {
      const response = await fetch("/update-manifest.json", { cache: "no-store" });
      if (!response.ok) throw new Error("Manifest unavailable");
      const result = (await response.json()) as UpdateManifest;
      if (typeof result.released !== "boolean") throw new Error("Invalid update manifest");
      setManifest(result);
      setCheckState("ready");
      setDownloadStarted(false);
    } catch {
      setCheckState("error");
      setManifest(null);
    }
  }, []);

  useEffect(() => {
    void checkForUpdates();
  }, [checkForUpdates]);

  const downloadUrl = manifest?.downloadUrl?.trim() ?? "";
  const safeDownloadUrl =
    downloadUrl.startsWith("/") || /^https:\/\//i.test(downloadUrl)
      ? downloadUrl
      : undefined;
  const updateAvailable = checkState === "ready" &&
    manifest?.released === true &&
    !!safeDownloadUrl;

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

      <main className="flex-1 flex flex-col items-center px-6 pt-5 pb-12 text-center">
        <div className="w-24 h-24 rounded-[28px] border tcy-line tcy-card flex items-center justify-center">
          <Logo size={68} />
        </div>

        <h2 className="mt-5 text-[25px] font-extrabold tcy-text">TeleChatYou</h2>
        <p className="mt-1 text-[14px] tcy-dim">Установленная версия {APP_VERSION}</p>

        <section className="mt-7 w-full max-w-sm rounded-2xl border tcy-line tcy-card p-4 text-left">
          <div className="flex items-start gap-3">
            {checkState === "error" ? (
              <AlertTriangle size={23} className="tcy-danger shrink-0 mt-0.5" />
            ) : updateAvailable ? (
              <Download size={23} className="tcy-accent shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 size={23} className="tcy-accent shrink-0 mt-0.5" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold tcy-text">
                {checkState === "loading"
                  ? "Проверяем обновления…"
                  : checkState === "error"
                    ? "Не удалось проверить обновления"
                    : updateAvailable
                      ? "Обновление Вышло!"
                      : manifest?.released
                        ? "Файл обновления ещё не опубликован"
                        : "Обновление не вышло"}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed tcy-dim">
                {checkState === "loading"
                  ? "Получаем актуальный статус выпуска."
                  : checkState === "error"
                    ? "Проверь подключение к интернету и попробуй ещё раз."
                    : updateAvailable
                      ? "Доступна новая версия TeleChatYou."
                      : manifest?.released
                        ? "Релиз объявлен, но ссылка на файл пока не добавлена."
                        : "Когда новая версия выйдет, здесь появятся кнопка скачивания и файл."}
              </p>
              {updateAvailable && manifest?.releaseNotes && (
                <p className="mt-2 text-[12px] leading-relaxed tcy-dim">{manifest.releaseNotes}</p>
              )}
            </div>
          </div>
        </section>

        {updateAvailable && manifest && safeDownloadUrl && (
          <div className="mt-5 w-full max-w-sm space-y-3">
            <a
              href={safeDownloadUrl}
              download={manifest.fileName || undefined}
              onClick={() => setDownloadStarted(true)}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-[14px] font-extrabold transition-opacity hover:opacity-90"
              style={{ background: "var(--tcy-selected-accent)", color: "var(--tcy-selected-on-accent)" }}
            >
              <Download size={18} />
              Скачать
            </a>

            <div className="flex items-center gap-3 rounded-2xl border tcy-line tcy-card p-3 text-left">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl tcy-card-strong tcy-accent">
                <FileArchive size={21} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold tcy-text">
                  {manifest.fileName || `TeleChatYou-${manifest.latestVersion || "update"}.apk`}
                </p>
                <p className="mt-1 text-[11px] tcy-dim">
                  Версия {manifest.latestVersion || "новая"} · файл обновления
                </p>
              </div>
            </div>

            {downloadStarted && (
              <TcButton size="lg" onClick={() => window.location.reload()}>
                <RefreshCw size={17} />
                Обновить
              </TcButton>
            )}
            <p className="text-[11px] leading-relaxed tcy-faint">
              Для APK на Android после скачивания открой файл и подтверди установку в системе.
              Кнопка «Обновить» перезагружает веб-версию, когда новый релиз уже развёрнут.
            </p>
          </div>
        )}

        <div className="mt-5 w-full max-w-sm">
          <TcButton size="lg" variant="soft" onClick={() => void checkForUpdates()} loading={checkState === "loading"}>
            <RefreshCw size={17} />
            Проверить обновления
          </TcButton>
        </div>
      </main>
    </div>
  );
}
