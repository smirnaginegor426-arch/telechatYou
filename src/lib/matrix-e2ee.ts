import {
  ClientEvent,
  RoomEvent,
  createClient,
  type MatrixClient,
} from "matrix-js-sdk";

const SESSION_KEY = "tcy.matrix.session.v1";

export type MatrixSession = {
  baseUrl: string;
  userId: string;
  deviceId: string;
  accessToken: string;
};

let activeClient: MatrixClient | null = null;
let activeSessionKey: string | null = null;
let initializedClient: MatrixClient | null = null;
let startedClient: MatrixClient | null = null;

function sessionIdentity(session: MatrixSession): string {
  return `${session.baseUrl}|${session.userId}|${session.deviceId}`;
}

export function normalizeHomeserverUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Введи корректный адрес Matrix-сервера, например https://matrix.org");
  }

  const localhost = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(localhost && url.protocol === "http:")) {
    throw new Error("Для безопасности Matrix-сервер должен использовать HTTPS.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("В адресе сервера нельзя указывать логин, пароль, параметры или фрагмент.");
  }

  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url.toString().replace(/\/$/, "");
}

export function readMatrixSession(): MatrixSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<MatrixSession>;
    if (
      typeof value.baseUrl !== "string" ||
      typeof value.userId !== "string" ||
      typeof value.deviceId !== "string" ||
      typeof value.accessToken !== "string" ||
      !value.accessToken ||
      !value.userId.startsWith("@")
    ) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return {
      baseUrl: normalizeHomeserverUrl(value.baseUrl),
      userId: value.userId,
      deviceId: value.deviceId,
      accessToken: value.accessToken,
    };
  } catch {
    return null;
  }
}

function saveMatrixSession(session: MatrixSession): void {
  // The token is kept in sessionStorage (not localStorage) so it does not
  // become a long-lived browser credential. Never send it to the TeleChat API.
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function initializeMatrixClient(session: MatrixSession): Promise<MatrixClient> {
  const identity = sessionIdentity(session);
  if (activeClient && activeSessionKey === identity && initializedClient === activeClient) {
    return activeClient;
  }
  // matrix-js-sdk's Rust crypto store is not thread-safe across concurrent clients.
  if (activeClient && activeSessionKey !== identity) {
    throw new Error("Сначала выйди из текущего Matrix-аккаунта, затем подключай другой.");
  }
  if (activeClient && initializedClient !== activeClient) {
    throw new Error("Matrix-клиент уже инициализируется. Подожди завершения операции.");
  }

  const client = createClient({
    baseUrl: session.baseUrl,
    accessToken: session.accessToken,
    userId: session.userId,
    deviceId: session.deviceId,
  });
  activeClient = client;
  activeSessionKey = identity;

  try {
    await client.initRustCrypto();
    initializedClient = client;
    return client;
  } catch (error) {
    client.stopClient();
    activeClient = null;
    activeSessionKey = null;
    initializedClient = null;
    throw error;
  }
}

export async function loginMatrix(
  homeserverInput: string,
  username: string,
  password: string,
): Promise<{ session: MatrixSession; client: MatrixClient }> {
  const baseUrl = normalizeHomeserverUrl(homeserverInput);
  const cleanUsername = username.trim();
  if (!cleanUsername || !password) {
    throw new Error("Введи Matrix ID и пароль Matrix-аккаунта.");
  }
  if (activeClient) {
    throw new Error("Сначала выйди из уже подключённого Matrix-аккаунта.");
  }

  const loginClient = createClient({ baseUrl });
  const response = await loginClient.loginRequest({
    type: "m.login.password",
    identifier: { type: "m.id.user", user: cleanUsername },
    password,
    initial_device_display_name: "TeleChat You",
    refresh_token: true,
  });

  if (!response.access_token || !response.user_id || !response.device_id) {
    throw new Error("Matrix-сервер вернул неполные данные устройства. Вход отменён.");
  }

  const session: MatrixSession = {
    baseUrl,
    userId: response.user_id,
    deviceId: response.device_id,
    accessToken: response.access_token,
  };

  try {
    saveMatrixSession(session);
    const client = await initializeMatrixClient(session);
    return { session, client };
  } catch (error) {
    sessionStorage.removeItem(SESSION_KEY);
    throw error;
  }
}

export function startMatrixSync(client: MatrixClient): void {
  if (startedClient === client) return;
  if (startedClient && startedClient !== client) {
    throw new Error("Другой Matrix-клиент уже выполняет синхронизацию.");
  }
  startedClient = client;
  client.startClient({ initialSyncLimit: 30 });
}

export function getActiveMatrixClient(): MatrixClient | null {
  return activeClient && initializedClient === activeClient ? activeClient : null;
}

export async function logoutMatrix(client?: MatrixClient | null): Promise<void> {
  const target = client ?? activeClient;
  sessionStorage.removeItem(SESSION_KEY);
  if (!target) return;

  if (startedClient === target) {
    target.stopClient();
    startedClient = null;
  }
  try {
    // Revoke the Matrix token on its own homeserver; local state is cleared even
    // if the remote server is temporarily unavailable.
    await target.logout(true);
  } finally {
    if (activeClient === target) {
      activeClient = null;
      activeSessionKey = null;
      initializedClient = null;
    }
  }
}

export function matrixClientEvents() {
  return { sync: ClientEvent.Sync, timeline: RoomEvent.Timeline };
}
