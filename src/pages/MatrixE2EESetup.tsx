import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, CircleAlert, KeyRound, LockKeyhole, LogOut, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router";
import {
  createMatrixEncryptedTestRoom,
  disconnectMatrixE2EE,
  getMatrixE2EEConfig,
  loginToMatrixE2EE,
  restoreMatrixE2EESession,
  type MatrixE2EESession,
} from "@/lib/matrix-e2ee-client";

type RoomResult = { roomId: string; algorithm: string };

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Не удалось выполнить действие. Проверь подключение к Matrix homeserver.";
}

export default function MatrixE2EESetup() {
  const navigate = useNavigate();
  const config = getMatrixE2EEConfig();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<MatrixE2EESession | null>(null);
  const [inviteId, setInviteId] = useState("");
  const [room, setRoom] = useState<RoomResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    if (!config.configured) return () => { live = false; };

    void restoreMatrixE2EESession()
      .then((restored) => {
        if (!live || !restored) return;
        setSession(restored.session);
        setNotice("Matrix подключён. Криптографическое хранилище устройства инициализировано.");
      })
      .catch((cause: unknown) => {
        if (live) setError(errorText(cause));
      });

    return () => { live = false; };
  }, [config.configured]);

  const connect = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    setError("");
    setRoom(null);
    try {
      const result = await loginToMatrixE2EE(identifier, password);
      setSession(result.session);
      setPassword("");
      setNotice("Matrix подключён. Клиент E2EE и локальное криптографическое хранилище запущены.");
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  };

  const createRoom = async () => {
    setBusy(true);
    setNotice("");
    setError("");
    setRoom(null);
    try {
      const result = await createMatrixEncryptedTestRoom(inviteId);
      setRoom(result);
      setNotice("Создана отдельная приватная Matrix-комната с включённым алгоритмом шифрования.");
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    setNotice("");
    setError("");
    try {
      await disconnectMatrixE2EE();
      setSession(null);
      setRoom(null);
      setInviteId("");
      setNotice("Matrix-сессия отключена. Обычные чаты TeleChat You не затронуты.");
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative h-full overflow-y-auto no-scrollbar pb-28">
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 pt-4 pb-3 safe-top tcy-solid">
        <button
          type="button"
          onClick={() => navigate("/settings")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full tcy-card"
          aria-label="Назад"
        >
          <ArrowLeft size={19} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[21px] font-extrabold tcy-text">Сквозное шифрование</h1>
          <p className="mt-0.5 text-[12px] tcy-dim">Matrix E2EE · экспериментальная настройка</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-[15px] tcy-card-strong tcy-accent">
          <ShieldCheck size={20} />
        </span>
      </header>

      <div className="mx-4 mt-3 flex flex-col gap-4">
        <section className="rounded-[22px] border tcy-line tcy-card p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] tcy-card-strong tcy-accent">
              <LockKeyhole size={21} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] font-bold tcy-text">Новые комнаты отдельно от старых чатов</h2>
              <p className="mt-1.5 text-[13px] leading-relaxed tcy-dim">
                Для криптографии используется официальный Matrix JavaScript SDK с Rust/WASM. Текущие личные чаты и история TeleChat You остаются на прежнем сервере и не меняются автоматически.
              </p>
            </div>
          </div>
        </section>

        {!config.configured ? (
          <section className="rounded-[22px] border tcy-line tcy-card p-4">
            <div className="flex items-start gap-3">
              <CircleAlert size={21} className="mt-0.5 shrink-0 text-amber-500" />
              <div>
                <h2 className="text-[15px] font-bold tcy-text">Matrix-сервер ещё не настроен</h2>
                <p className="mt-2 text-[13px] leading-relaxed tcy-dim">
                  Прежде чем подключаться, нужно развернуть Matrix homeserver с HTTPS и указать его URL в переменной сборки
                  <span className="mx-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] tcy-card-strong">VITE_MATRIX_HOMESERVER_URL</span>.
                  Входные данные нельзя отправлять на случайный сервер, поэтому поле адреса сервера здесь намеренно отсутствует.
                </p>
              </div>
            </div>
          </section>
        ) : (
          <>
            <section className="rounded-[22px] border tcy-line tcy-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <KeyRound size={18} className="tcy-accent" />
                <h2 className="text-[15px] font-bold tcy-text">{session ? "Matrix-аккаунт подключён" : "Подключить Matrix-аккаунт"}</h2>
              </div>
              <p className="mb-3 break-all text-[12px] tcy-dim">{config.baseUrl}</p>

              {session ? (
                <div className="flex flex-col gap-3">
                  <div className="rounded-[15px] p-3 tcy-card-strong">
                    <div className="text-[11px] tcy-dim">Matrix ID</div>
                    <div className="mt-1 break-all text-[14px] font-semibold tcy-text">{session.userId}</div>
                    <div className="mt-3 text-[11px] tcy-dim">ID устройства</div>
                    <div className="mt-1 break-all font-mono text-[12px] tcy-text">{session.deviceId}</div>
                  </div>
                  <div className="flex items-start gap-2 text-[12px] leading-relaxed tcy-dim">
                    <CheckCircle2 size={17} className="mt-0.5 shrink-0 tcy-accent" />
                    E2EE-криптография и постоянное хранилище ключей устройства инициализированы в этом браузере/WebView.
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void disconnect()}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-[14px] border tcy-line px-4 text-[13px] font-semibold tcy-text disabled:opacity-50"
                  >
                    <LogOut size={16} /> Отключить Matrix
                  </button>
                </div>
              ) : (
                <form onSubmit={(event) => void connect(event)} className="flex flex-col gap-3">
                  <label className="flex flex-col gap-1.5 text-[12px] font-semibold tcy-dim">
                    Matrix ID или имя пользователя
                    <input
                      value={identifier}
                      onChange={(event) => setIdentifier(event.target.value)}
                      autoComplete="username"
                      required
                      maxLength={255}
                      placeholder="@пользователь:сервер"
                      className="h-11 rounded-[13px] border tcy-line tcy-solid px-3 text-[14px] tcy-text outline-none focus:border-[var(--tcy-accent)]"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-[12px] font-semibold tcy-dim">
                    Пароль Matrix
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="current-password"
                      required
                      maxLength={256}
                      className="h-11 rounded-[13px] border tcy-line tcy-solid px-3 text-[14px] tcy-text outline-none focus:border-[var(--tcy-accent)]"
                    />
                  </label>
                  <p className="text-[11.5px] leading-relaxed tcy-dim">
                    Это отдельный Matrix-логин, не пароль TeleChat You. Пароль не сохраняется. Токен сессии хранится только до закрытия вкладки/сессии браузера.
                  </p>
                  <button
                    type="submit"
                    disabled={busy || !identifier.trim() || !password}
                    className="min-h-11 rounded-[14px] px-4 text-[13px] font-bold text-white disabled:opacity-50"
                    style={{ background: "var(--tcy-accent)" }}
                  >
                    {busy ? "Подключение…" : "Подключить"}
                  </button>
                </form>
              )}
            </section>

            {session && (
              <section className="rounded-[22px] border tcy-line tcy-card p-4">
                <h2 className="text-[15px] font-bold tcy-text">Создать защищённую тестовую комнату</h2>
                <p className="mt-1.5 text-[12.5px] leading-relaxed tcy-dim">
                  Пригласи второй Matrix-аккаунт. Комната создаётся в Matrix, а не в старой таблице сообщений TeleChat You.
                </p>
                <label className="mt-3 flex flex-col gap-1.5 text-[12px] font-semibold tcy-dim">
                  Matrix ID собеседника
                  <input
                    value={inviteId}
                    onChange={(event) => setInviteId(event.target.value)}
                    placeholder="@друг:сервер"
                    maxLength={255}
                    className="h-11 rounded-[13px] border tcy-line tcy-solid px-3 text-[14px] tcy-text outline-none focus:border-[var(--tcy-accent)]"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void createRoom()}
                  disabled={busy || !/^@[^:\s]+:[^:\s]+$/.test(inviteId.trim())}
                  className="mt-3 min-h-11 w-full rounded-[14px] px-4 text-[13px] font-bold text-white disabled:opacity-50"
                  style={{ background: "var(--tcy-accent)" }}
                >
                  {busy ? "Создание…" : "Создать зашифрованную комнату"}
                </button>

                {room && (
                  <div className="mt-3 rounded-[15px] p-3 tcy-card-strong">
                    <div className="flex items-center gap-2 text-[12px] font-bold tcy-accent">
                      <CheckCircle2 size={16} /> Комната создана
                    </div>
                    <p className="mt-2 text-[11px] tcy-dim">Алгоритм комнаты</p>
                    <p className="mt-1 break-all font-mono text-[12px] tcy-text">{room.algorithm}</p>
                    <p className="mt-2 text-[11px] tcy-dim">Room ID</p>
                    <p className="mt-1 break-all font-mono text-[12px] tcy-text">{room.roomId}</p>
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard?.writeText(room.roomId)}
                      className="mt-3 rounded-[10px] border tcy-line px-3 py-2 text-[12px] font-semibold tcy-text"
                    >
                      Скопировать Room ID
                    </button>
                  </div>
                )}
              </section>
            )}
          </>
        )}

        {notice && (
          <div role="status" className="rounded-[15px] border tcy-line p-3 text-[12.5px] leading-relaxed tcy-text">
            {notice}
          </div>
        )}
        {error && (
          <div role="alert" className="rounded-[15px] border border-red-500/30 bg-red-500/5 p-3 text-[12.5px] leading-relaxed text-red-500">
            {error}
          </div>
        )}
        <p className="px-1 text-[11px] leading-relaxed tcy-dim">
          Этот этап — только подключение Matrix и создание тестовой комнаты. Мы пока не переключаем сообщения TeleChat You на Matrix и не считаем старые переписки сквозным шифрованием.
        </p>
      </div>
    </div>
  );
}
