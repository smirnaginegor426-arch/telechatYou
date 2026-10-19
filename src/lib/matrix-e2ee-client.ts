import * as sdk from "matrix-js-sdk";
import type { MatrixClient } from "matrix-js-sdk";

export type MatrixE2EESession = {
  baseUrl: string;
  accessToken: string;
  userId: string;
  deviceId: string;
};

const SESSION_KEY = "tcy-matrix-e2ee-session-v1";
const ENCRYPTION_ALGORITHM = "m.megolm.v1.aes-sha2";

let activeClient: MatrixClient | null = null;
let activeSession: MatrixE2EESession | null = null;
let startPromise: Promise<MatrixClient> | null = null;

function configuredHomeserverUrl(): string | null {
  const raw = import.meta.env.VITE_MATRIX_HOMESERVER_URL?.trim();
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    const localHost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (parsed.protocol !== "https:" && !(localHost && parsed.protocol === "http:")) return null;
    if (parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

/** Only use the operator-configured homeserver; never accept an arbitrary URL from a login form. */
export function getMatrixE2EEConfig() {
  const baseUrl = configuredHomeserverUrl();
  return {
    configured: baseUrl !== null,
    baseUrl,
    protocol: "Matrix Olm/Megolm via matrix-js-sdk + Rust WASM",
    sessionStorage: "sessionStorage + Matrix SDK IndexedDB crypto store",
  } as const;
}

function readSession(): MatrixE2EESession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const session = value as Partial<MatrixE2EESession>;
    const baseUrl = configuredHomeserverUrl();
    if (
      !baseUrl ||
      session.baseUrl !== baseUrl ||
      typeof session.accessToken !== "string" ||
      !session.accessToken ||
      typeof session.userId !== "string" ||
      !session.userId.startsWith("@") ||
      typeof session.deviceId !== "string" ||
      !session.deviceId
    ) return null;
    return session as MatrixE2EESession;
  } catch {
    return null;
  }
}

function saveSession(session: MatrixE2EESession): void {
  // Keep the bearer token out of localStorage and never persist the password.
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession(): void {
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Session storage can be unavailable in private browsing / strict WebViews.
  }
}

async function startClientForSession(session: MatrixE2EESession): Promise<MatrixClient> {
  if (activeClient && activeSession?.deviceId === session.deviceId && activeSession.userId === session.userId) {
    return activeClient;
  }

  // matrix-js-sdk crypto state is not thread-safe; keep a single client bound
  // to its IndexedDB store for the life of this document.
  if (startPromise) return startPromise;

  startPromise = (async () => {
    const client = sdk.createClient({
      baseUrl: session.baseUrl,
      accessToken: session.accessToken,
      userId: session.userId,
      deviceId: session.deviceId,
      timelineSupport: true,
    });
    try {
      await client.initRustCrypto();
      await client.startClient({ initialSyncLimit: 10 });
      activeClient = client;
      activeSession = session;
      return client;
    } catch (error) {
      client.stopClient();
      throw error;
    } finally {
      startPromise = null;
    }
  })();

  return startPromise;
}

export async function restoreMatrixE2EESession(): Promise<{
  client: MatrixClient;
  session: MatrixE2EESession;
} | null> {
  const session = readSession();
  if (!session) {
    clearSession();
    return null;
  }
  const client = await startClientForSession(session);
  return { client, session };
}

export async function loginToMatrixE2EE(
  identifier: string,
  password: string,
): Promise<{ client: MatrixClient; session: MatrixE2EESession }> {
  const baseUrl = configuredHomeserverUrl();
  if (!baseUrl) {
    throw new Error("Matrix homeserver не настроен. Сначала задай VITE_MATRIX_HOMESERVER_URL в окружении сборки.");
  }
  if (!identifier.trim() || !password) {
    throw new Error("Введи Matrix ID/имя пользователя и пароль.");
  }
  if (activeClient || startPromise) {
    throw new Error("Matrix-сессия уже активна. Сначала отключи её.");
  }

  // Authentication goes directly to the configured Matrix homeserver.
  // TeleChat You's API never receives this password or the Matrix access token.
  const unauthenticated = sdk.createClient({ baseUrl });
  const credentials = await unauthenticated.login("m.login.password", {
    identifier: { type: "m.id.user", user: identifier.trim() },
    password,
    initial_device_display_name: "TeleChat You — E2EE",
  });

  if (!credentials.access_token || !credentials.user_id || !credentials.device_id) {
    throw new Error("Homeserver не вернул полный набор данных сессии.");
  }

  const session: MatrixE2EESession = {
    baseUrl,
    accessToken: credentials.access_token,
    userId: credentials.user_id,
    deviceId: credentials.device_id,
  };

  saveSession(session);
  try {
    const client = await startClientForSession(session);
    return { client, session };
  } catch (error) {
    clearSession();
    activeClient = null;
    activeSession = null;
    throw error;
  }
}

export async function createMatrixEncryptedTestRoom(
  inviteUserId: string,
): Promise<{ roomId: string; algorithm: string }> {
  const session = activeSession ? { ...activeSession } : readSession();
  if (!session) throw new Error("Сначала подключи Matrix-аккаунт.");
  const client = activeClient ?? await startClientForSession(session);

  const invite = inviteUserId.trim();
  if (!/^@[^:\s]+:[^:\s]+$/.test(invite)) {
    throw new Error("Введи Matrix ID собеседника в формате @пользователь:сервер.");
  }

  const result = await client.createRoom({
    name: "TeleChat You — защищённый тест",
    visibility: "private",
    preset: "private_chat",
    invite: [invite],
    initial_state: [{
      type: "m.room.encryption",
      state_key: "",
      content: { algorithm: ENCRYPTION_ALGORITHM },
    }],
  });

  if (!result.room_id) throw new Error("Matrix homeserver не вернул ID комнаты.");
  return { roomId: result.room_id, algorithm: ENCRYPTION_ALGORITHM };
}

export async function disconnectMatrixE2EE(): Promise<void> {
  const client = activeClient;
  activeClient = null;
  activeSession = null;
  clearSession();
  startPromise = null;

  if (client) {
    client.stopClient();
    try {
      await client.logout();
    } catch {
      // Local cleanup still happens if the homeserver is offline.
    }
  }
}
