/**
 * Accounts allowed to display the TeleChat You tester badge.
 * Both username and numeric user ID must match.
 */
const TESTERS = [
  { username: "artemizzz", userId: 848009 },
  { username: "amongopin", userId: 1573622 },
] as const;

/**
 * Accounts receiving the current experimental interface.
 * UI release access is based on numeric account IDs, not mutable usernames.
 */
export const PRIVATE_EXPERIMENTAL_USERS = [
  { username: "teste", userId: 1633623 },
  { username: "artemizzz", userId: 848009 },
] as const;

/** Backwards-compatible export for code that expects the original account. */
export const PRIVATE_EXPERIMENTAL_USER = PRIVATE_EXPERIMENTAL_USERS[0];

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
 * The current interface is enabled only for approved account IDs.
 * Tester-badge checks remain separate in isTesterUsername().
 */
export function isPrivateExperimentalUser(
  _username?: string | null,
  userId?: number | string | null,
): boolean {
  const normalizedUserId = normalizeUserId(userId);
  return Number.isSafeInteger(normalizedUserId) &&
    PRIVATE_EXPERIMENTAL_USERS.some((user) => user.userId === normalizedUserId);
}
