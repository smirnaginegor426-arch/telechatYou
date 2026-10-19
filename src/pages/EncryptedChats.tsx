import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, LockKeyhole, LogOut, Plus, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { ClientEvent, RoomEvent, type MatrixClient, type Room } from "matrix-js-sdk";
import {
  getActiveMatrixClient,
  initializeMatrixClient,
  loginMatrix,
  logoutMatrix,
  readMatrixSession,
  startMatrixSync,
  type MatrixSession,
} from "@/lib/matrix-e2ee";
import { TcButton } from "@/components/TcButton";

type RoomSummary = {
  id: string;
  name: string;
  members: number;
};

type TimelineItem = {
  id: string;
  sender: string;
  body: string;
  timestamp: number;
  own: boolean;
};

function getEncryptedRooms(client: MatrixClient): RoomSummary[] {
  return client.getRooms()
    .filter((room) => room.hasEncryptionStateEvent())
    .map((room) => ({
      id: room.roomId,
      name: room.name || room.roomId,
      members: room.getJoinedMembers().length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getRoomTimeline(room: Room | null, userId: string): TimelineItem[] {
  if (!room || !room.hasEncryptionStateEvent()) return [];
  return room.getLiveTimeline().getEvents()
    .filter((event) => event.getType() === "m.room.message" || event.getType() === "m.room.encrypted")
    .slice(-150)
    .map((event) => {
      const content = event.getContent() as { body?: unknown; msgtype?: unknown };
      const body = typeof content.body === "string"
        ? content.body
        : event.getType() === "m.room.encrypted"
          ? "Не удалось расшифровать сообщение на этом устройстве"
          : "";
      return {
        id: event.getId() ?? `${event.getTs()}-${event.getSender() ?? "event"}`,
        sender: event.getSender() ?? "Matrix",
        body,
        timestamp: event.getTs(),
        own: event.getSender() === userId,
      };
    })
    .filter((item) => item.body.length > 0);
}

function formatClock(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(timestamp);
  } catch {
    return "";
  }
}

function safeMatrixError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message;
    if (/M_FORBIDDEN|M_UNKNOWN_TOKEN|401|403/i.test(message)) {
      return "Matrix-сервер отклонил вход. Проверь Matrix ID, пароль и адрес сервера.";
    }
    if (/CORS|fetch|network|failed to connect|ECONN|ENOTFOUND/i.test(message)) {
      return "Не удалось связаться с Matrix-сервером. Проверь HTTPS, адрес и поддержку CORS.";
    }
    return message.slice(0, 240);
  }
  return "Не удалось выполнить операцию Matrix.";
}

export default function EncryptedChats() {
  const navigate = useNavigate();
  const [session, setSession] = useState<MatrixSession | null>(null);
  const [client, setClient] = useState<MatrixClient | null>(null);
  const [homeserver, setHomeserver] = useState("https://matrix.org");
  const [matrixUser, setMatrixUser] = useState("");
  const [matrixPassword, setMatrixPassword] = useState("");
  const [roomName, setRoomName] = useState("");
  const [inviteUser, setInviteUser] = useState("");
  const [draft, setDraft] = useState("");
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [syncState, setSyncState] = useState("Ожидает подключения");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId],
  );

  const refreshClientState = useCallback((matrixClient: MatrixClient) => {
    const nextRooms = getEncryptedRooms(matrixClient);
    setRooms(nextRooms);
    setSelectedRoomId((current) => (
      current && nextRooms.some((room) => room.id === current)
        ? current
        : nextRooms[0]?.id ?? ""
    ));
  }, []);

  const loadSession = useCallback(async (saved: MatrixSession) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const matrixClient = await initializeMatrixClient(saved);
      setSession(saved);
      setClient(matrixClient);
      setHomeserver(saved.baseUrl);
      setMatrixUser(saved.userId);
      refreshClientState(matrixClient);
      setSyncState("Подключаемся…");

      const onSync = (state: string) => {
        setSyncState(state);
        refreshClientState(matrixClient);
      };
      const onTimeline = () => refreshClientState(matrixClient);
      matrixClient.on(ClientEvent.Sync, onSync);
      matrixClient.on(RoomEvent.Timeline, onTimeline);
      startMatrixSync(matrixClient);
      setNotice("Криптографический модуль Matrix инициализирован. Дождись синхронизации списка чатов.");
    } catch (cause) {
      setError(safeMatrixError(cause));
    } finally {
      setBusy(false);
    }
  }, [refreshClientState]);

  useEffect(() => {
    const saved = readMatrixSession();
    if (saved) void loadSession(saved);
  }, [loadSession]);

  useEffect(() => {
    if (!client || !session || !selectedRoomId) {
      setTimeline([]);
      return;
    }
    const room = client.getRoom(selectedRoomId);
    setTimeline(getRoomTimeline(room, session.userId));
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [client, session, selectedRoomId, rooms]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [timeline]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    setMatrixPassword("");
    try {
      const result = await loginMatrix(homeserver, matrixUser, matrixPassword);
      setSession(result.session);
      setClient(result.client);
      setHomeserver(result.session.baseUrl);
      setMatrixUser(result.session.userId);
      setSyncState("Подключаемся…");
      const onSync = (state: string) => {
        setSyncState(state);
        refreshClientState(result.client);
      };
      const onTimeline = () => refreshClientState(result.client);
      result.client.on(ClientEvent.Sync, onSync);
      result.client.on(RoomEvent.Timeline, onTimeline);
      startMatrixSync(result.client);
      refreshClientState(result.client);
      setNotice("E2EE-модуль инициализирован. Обычные чаты TeleChat You не изменены.");
    } catch (cause) {
      setError(safeMatrixError(cause));
    } finally {
      setBusy(false);
    }
  };

  const createEncryptedRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!client || !roomName.trim()) return;
    const invite = inviteUser.trim();
    if (invite && !/^@[^s:]+:.+$/.test(invite)) {
      setError("Matrix ID собеседника должен выглядеть так: @имя:сервер");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await client.createRoom({
        name: roomName.trim().slice(0, 80),
        preset: "private_chat",
        is_direct: Boolean(invite),
        invite: invite ? [invite] : [],
        initial_state: [{
          type: "m.room.encryption",
          state_key: "",
          content: { algorithm: "m.megolm.v1.aes-sha2" },
        }],
      });
      setRoomName("");
      setInviteUser("");
      if (result.room_id) setSelectedRoomId(result.room_id);
      setNotice("Запрос на создание зашифрованной комнаты отправлен. Проверяем её состояние…");
      refreshClientState(client);
    } catch (cause) {
      setError(safeMatrixError(cause));
    } finally {
      setBusy(false);
    }
  };

  const sendEncryptedMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
    if (!client || !selectedRoomId || !body || busy) return;
    const room = client.getRoom(selectedRoomId);
    // Fail closed: never call sendEvent unless the room is marked encrypted.
    if (!room?.hasEncryptionStateEvent()) {
      setError("Отправка остановлена: выбранная комната не подтверждена как зашифрованная.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await client.sendEvent(selectedRoomId, "m.room.message", {
        msgtype: "m.text",
        body,
      });
      setDraft("");
      setTimeline(getRoomTimeline(client.getRoom(selectedRoomId), session?.userId ?? ""));
    } catch (cause) {
      setError(safeMatrixError(cause));
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    setError("");
    const oldClient = client ?? getActiveMatrixClient();
    try {
      await logoutMatrix(oldClient);
    } catch (cause) {
      setError("Локальная сессия очищена, но Matrix-сервер не подтвердил выход: " + safeMatrixError(cause));
    } finally {
      setClient(null);
      setSession(null);
      setRooms([]);
      setSelectedRoomId("");
      setTimeline([]);
      setSyncState("Отключён");
      setBusy(false);
    }
  };

  const syncLabel = syncState === "PREPARED" || syncState === "SYNCING"
    ? "Подключено"
    : syncState === "RECONNECTING"
      ? "Переподключение…"
      : syncState === "ERROR"
        ? "Ошибка синхронизации"
        : syncState;

  return (
    <div className="relative flex h-full min-h-0 flex-col tcy-bg">
      <header className="flex shrink-0 items-center gap-3 border-b px-4 py-4" style={{ borderColor: "var(--tcy-line)", background: "var(--tcy-header)" }}>
        <button type="button" onClick={() => navigate(-1)} aria-label="Назад" className="tcy-press flex h-10 w-10 items-center justify-center rounded-full tcy-card-strong">
          <ArrowLeft size={19} />
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border" style={{ borderColor: "var(--tcy-glass-line)", background: "color-mix(in srgb, var(--tcy-selected-accent) 18%, transparent)" }}>
          <LockKeyhole size={19} className="tcy-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-[16px] font-extrabold tcy-text">Зашифрованные чаты</h1>
          <p className="truncate text-[11px] tcy-dim">{session ? `${session.userId} · ${syncLabel}` : "Matrix E2EE · Бета"}</p>
        </div>
        {session && (
          <button type="button" onClick={() => void handleLogout()} disabled={busy} title="Выйти из Matrix" className="tcy-press flex h-10 w-10 items-center justify-center rounded-full tcy-card-strong disabled:opacity-50">
            <LogOut size={17} />
          </button>
        )}
      </header>

      {!session ? (
        <div className="mx-auto flex w-full max-w-[560px] flex-1 items-start overflow-y-auto px-4 py-6">
          <div className="w-full space-y-5">
            <div className="rounded-[24px] border p-5" style={{ borderColor: "var(--tcy-line)", background: "var(--tcy-card)" }}>
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-[16px]" style={{ background: "color-mix(in srgb, var(--tcy-selected-accent) 18%, transparent)" }}>
                <ShieldCheck size={23} className="tcy-accent" />
              </div>
              <h2 className="text-[18px] font-extrabold tcy-text">Подключить Matrix</h2>
              <p className="mt-2 text-[13px] leading-relaxed tcy-dim">
                Для E2EE нужен отдельный Matrix-аккаунт и доступный homeserver. Эти данные не передаются серверу TeleChat You. Пароль используется только для входа на выбранный Matrix-сервер.
              </p>
            </div>
            <form onSubmit={handleLogin} className="space-y-3">
              <label className="block space-y-1.5">
                <span className="pl-1 text-[12px] font-bold tcy-dim">Адрес Matrix-сервера</span>
                <input autoCapitalize="none" autoCorrect="off" inputMode="url" type="url" required value={homeserver} onChange={(e) => setHomeserver(e.target.value)} placeholder="https://matrix.example.org" className="w-full rounded-[16px] border px-4 py-3 text-[14px] outline-none tcy-text" style={{ background: "var(--tcy-input)", borderColor: "var(--tcy-line-strong)" }} />
              </label>
              <label className="block space-y-1.5">
                <span className="pl-1 text-[12px] font-bold tcy-dim">Matrix ID или имя пользователя</span>
                <input autoCapitalize="none" autoCorrect="off" autoComplete="username" required value={matrixUser} onChange={(e) => setMatrixUser(e.target.value)} placeholder="@user:matrix.org" className="w-full rounded-[16px] border px-4 py-3 text-[14px] outline-none tcy-text" style={{ background: "var(--tcy-input)", borderColor: "var(--tcy-line-strong)" }} />
              </label>
              <label className="block space-y-1.5">
                <span className="pl-1 text-[12px] font-bold tcy-dim">Пароль Matrix-аккаунта</span>
                <input autoComplete="current-password" required type="password" value={matrixPassword} onChange={(e) => setMatrixPassword(e.target.value)} className="w-full rounded-[16px] border px-4 py-3 text-[14px] outline-none tcy-text" style={{ background: "var(--tcy-input)", borderColor: "var(--tcy-line-strong)" }} />
              </label>
              <TcButton type="submit" disabled={busy} size="lg" className="w-full">
                <LockKeyhole size={16} /> {busy ? "Подключаем E2EE…" : "Подключить"}
              </TcButton>
            </form>
            <p className="text-[11px] leading-relaxed tcy-dim">
              Вход подключает этот интерфейс к Matrix, а не превращает аккаунт TeleChat You в Matrix-аккаунт. Используй только доверенный сервер; при ошибке инициализации отправка сообщений не включается.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <aside className="flex max-h-[36%] shrink-0 flex-col border-b md:max-h-none md:w-[280px] md:border-b-0 md:border-r" style={{ borderColor: "var(--tcy-line)" }}>
            <form onSubmit={createEncryptedRoom} className="space-y-2 border-b p-3" style={{ borderColor: "var(--tcy-line)" }}>
              <p className="px-1 text-[12px] font-extrabold tcy-text">Новый зашифрованный чат</p>
              <input required value={roomName} onChange={(e) => setRoomName(e.target.value)} maxLength={80} placeholder="Название комнаты" className="w-full rounded-[13px] border px-3 py-2.5 text-[12px] outline-none tcy-text" style={{ background: "var(--tcy-input)", borderColor: "var(--tcy-line)" }} />
              <input value={inviteUser} onChange={(e) => setInviteUser(e.target.value)} autoCapitalize="none" autoCorrect="off" placeholder="@собеседник:сервер (необязательно)" className="w-full rounded-[13px] border px-3 py-2.5 text-[12px] outline-none tcy-text" style={{ background: "var(--tcy-input)", borderColor: "var(--tcy-line)" }} />
              <TcButton type="submit" disabled={busy} size="md" className="w-full"><Plus size={15} /> Создать с E2EE</TcButton>
            </form>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[12px] font-extrabold tcy-text">Зашифрованные комнаты</span>
              <button type="button" onClick={() => client && refreshClientState(client)} className="tcy-press rounded-full p-1.5 tcy-dim" aria-label="Обновить список"><RefreshCw size={14} /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
              {rooms.length === 0 ? (
                <p className="px-3 py-5 text-[12px] leading-relaxed tcy-dim">Пока нет зашифрованных комнат. Создай новую или попроси собеседника пригласить тебя в Matrix-комнату с E2EE.</p>
              ) : rooms.map((room) => (
                <button type="button" key={room.id} onClick={() => setSelectedRoomId(room.id)} className="mb-1 flex w-full items-center gap-3 rounded-[16px] px-3 py-3 text-left transition-colors" style={{ background: selectedRoomId === room.id ? "color-mix(in srgb, var(--tcy-selected-accent) 20%, transparent)" : "transparent" }}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full tcy-card-strong"><LockKeyhole size={16} className="tcy-accent" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-bold tcy-text">{room.name}</span>
                    <span className="block text-[10.5px] tcy-dim">{room.members} участников · E2EE</span>
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <section className="flex min-h-0 min-w-0 flex-1 flex-col">
            {selectedRoom ? (
              <>
                <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3" style={{ borderColor: "var(--tcy-line)" }}>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full tcy-card-strong"><LockKeyhole size={15} className="tcy-accent" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-extrabold tcy-text">{selectedRoom.name}</p>
                    <p className="text-[10.5px] tcy-dim">Содержимое шифруется Matrix SDK</p>
                  </div>
                  <ShieldCheck size={16} className="tcy-accent" />
                </div>
                <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4">
                  {timeline.length === 0 ? (
                    <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 text-center">
                      <LockKeyhole size={25} className="tcy-accent" />
                      <p className="text-[12px] tcy-dim">Комната зашифрована. История появится после синхронизации.</p>
                    </div>
                  ) : timeline.map((item) => (
                    <div key={item.id} className={`flex ${item.own ? "justify-end" : "justify-start"}`}>
                      <div className="max-w-[86%] rounded-[18px] border px-3 py-2" style={{ background: item.own ? "color-mix(in srgb, var(--tcy-selected-accent) 22%, var(--tcy-card))" : "var(--tcy-card-strong)", borderColor: "var(--tcy-line)" }}>
                        {!item.own && <p className="mb-1 text-[10px] font-bold tcy-accent">{item.sender}</p>}
                        <p className="whitespace-pre-wrap break-words text-[13px] tcy-text">{item.body}</p>
                        <p className="mt-1 text-right text-[9px] tcy-dim">{formatClock(item.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <form onSubmit={sendEncryptedMessage} className="flex shrink-0 items-end gap-2 border-t p-3" style={{ borderColor: "var(--tcy-line)" }}>
                  <textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={8000} rows={1} placeholder="Сообщение с E2EE…" className="max-h-28 min-h-[44px] min-w-0 flex-1 resize-y rounded-[16px] border px-3 py-3 text-[13px] outline-none tcy-text" style={{ background: "var(--tcy-input)", borderColor: "var(--tcy-line-strong)" }} />
                  <button type="submit" disabled={busy || !draft.trim() || !selectedRoomId} aria-label="Отправить зашифрованное сообщение" className="tcy-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-45" style={{ background: "var(--tcy-selected-accent)", color: "var(--tcy-selected-on-accent)" }}><Send size={17} /></button>
                </form>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                <LockKeyhole size={31} className="tcy-accent" />
                <p className="text-[14px] font-extrabold tcy-text">Выбери зашифрованную комнату</p>
                <p className="max-w-[300px] text-[12px] tcy-dim">Обычные чаты TeleChat You остаются отдельно и продолжают работать по прежней схеме.</p>
              </div>
            )}
          </section>
        </div>
      )}

      {(error || notice) && (
        <div className="absolute bottom-3 left-3 right-3 z-20 mx-auto max-w-[620px] space-y-2">
          {error && <div role="alert" className="rounded-[15px] border px-4 py-3 text-[12px] tcy-text" style={{ background: "var(--tcy-solid)", borderColor: "var(--tcy-danger)" }}>{error}</div>}
          {notice && !error && <div role="status" className="rounded-[15px] border px-4 py-3 text-[12px] tcy-text" style={{ background: "var(--tcy-solid)", borderColor: "var(--tcy-line-strong)" }}>{notice}</div>}
        </div>
      )}
    </div>
  );
}
