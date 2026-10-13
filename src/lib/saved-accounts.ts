export type SavedAccount = {
  slotId: string;
  username: string;
  displayName: string;
  avatarKey?: string | null;
  addedAt: number;
};

export const SAVED_ACCOUNTS_KEY = "tcy.saved-accounts.v1";
export const SAVED_ACCOUNTS_CHANGED_EVENT = "tcy-saved-accounts-changed";
export const MAX_SAVED_ACCOUNTS = 5;

const SLOT_ID_PATTERN = /^[a-f0-9]{32}$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,32}$/;

export function createAccountSlotId(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function readSavedAccounts(): SavedAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAVED_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
      .map((item) => ({
        slotId: typeof item.slotId === "string" ? item.slotId : "",
        username: typeof item.username === "string" ? item.username : "",
        displayName: typeof item.displayName === "string" ? item.displayName : "",
        avatarKey: typeof item.avatarKey === "string" ? item.avatarKey : null,
        addedAt: typeof item.addedAt === "number" ? item.addedAt : Date.now(),
      }))
      .filter((item) => SLOT_ID_PATTERN.test(item.slotId) && USERNAME_PATTERN.test(item.username))
      .slice(0, MAX_SAVED_ACCOUNTS);
  } catch {
    return [];
  }
}

function writeSavedAccounts(accounts: SavedAccount[]): SavedAccount[] {
  const safe = accounts.slice(0, MAX_SAVED_ACCOUNTS);
  try {
    window.localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(safe));
    window.dispatchEvent(new Event(SAVED_ACCOUNTS_CHANGED_EVENT));
  } catch {
    // Keep working in the current view if browser storage is unavailable.
  }
  return safe;
}

export function upsertSavedAccount(account: Omit<SavedAccount, "addedAt"> & { addedAt?: number }): SavedAccount[] {
  const existing = readSavedAccounts();
  const previous = existing.find(
    (item) => item.slotId === account.slotId || item.username.toLowerCase() === account.username.toLowerCase(),
  );
  const nextAccount: SavedAccount = {
    ...account,
    addedAt: previous?.addedAt ?? account.addedAt ?? Date.now(),
  };
  return writeSavedAccounts([
    nextAccount,
    ...existing.filter(
      (item) =>
        item.slotId !== account.slotId &&
        item.username.toLowerCase() !== account.username.toLowerCase(),
    ),
  ]);
}

export function forgetSavedAccount(slotId: string): SavedAccount[] {
  return writeSavedAccounts(readSavedAccounts().filter((item) => item.slotId !== slotId));
}
