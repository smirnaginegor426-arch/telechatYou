/**
 * Accounts allowed to display the TeleChat You tester badge.
 * Both username and numeric user ID must match.
 */
const TESTERS = [
  { username: "artemizzz", userId: 848009 },
  { username: "amongopin", userId: 1573622 },
] as const;

/**
 * Account reserved for the current experimental interface.
 * UI release access is based on numeric account ID, not mutable usernames.
 */
export const PRIVATE_EXPERIMENTAL_USER = {
  username: "teste",
  userId: 1633623,
} as const;

function normalizeUsername(username?: string | null) {
  return username?.trim().replace(/^@/, "").toLowerCase();
}

function normalizeUserId(userId?: number | string | null) {
  return userId == null || userId === "" ? NaN : Number(userId);
}

export function isTesterUsername(
  username?: string | null,
  userId?: number | string | null,
): boolean {
  const normalized = normalizeUsername(username);
  const normalizedUserId = normalizeUserId(userId);

  return !!normalized &&
    Number.isSafeInteger(normalizedUserId) &&
    TESTERS.some(
      (tester) =>
        tester.username === normalized &&
        tester.userId === normalizedUserId,
    );
}

/**
 * The current interface is enabled only for the designated account ID.
 * Tester-badge checks remain separate in isTesterUsername().
 */
export function isPrivateExperimentalUser(
  _username?: string | null,
  userId?: number | string | null,
): boolean {
  const normalizedUserId = normalizeUserId(userId);
  return Number.isSafeInteger(normalizedUserId) &&
    normalizedUserId === PRIVATE_EXPERIMENTAL_USER.userId;
}
