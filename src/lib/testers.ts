/**
 * Accounts allowed to display the TeleChat You tester badge.
 * Both username and numeric user ID must match.
 */
const TESTERS = [
  { username: "artemizzz", userId: 848009 },
  { username: "amongopin", userId: 1573622 },
] as const;

/**
 * Previous private-rollout target, retained as metadata for reference.
 * The experimental interface is now enabled for everyone.
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
 * Public rollout: the current interface is enabled for every account.
 * Tester-badge checks remain separate in isTesterUsername().
 */
export function isPrivateExperimentalUser(
  _username?: string | null,
  _userId?: number | string | null,
): boolean {
  return true;
}
