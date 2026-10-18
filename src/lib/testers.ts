/**
 * Accounts allowed to display the TeleChat You tester badge.
 * Both username and numeric user ID must match.
 */
const TESTERS = [
  { username: "artemizzz", userId: 848009 },
  { username: "amongopin", userId: 1573622 },
] as const;

/**
 * The single private account that sees experimental interface changes
 * (calm chat refresh, new wallpapers, tabbed settings).
 * Kept separate from the public tester badge list on purpose.
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
 * True only for the private experimental-UI account.
 * The numeric ID is authoritative; username changes do not affect access.
 */
export function isPrivateExperimentalUser(
  _username?: string | null,
  userId?: number | string | null,
): boolean {
  const normalizedUserId = normalizeUserId(userId);
  return Number.isSafeInteger(normalizedUserId) &&
    normalizedUserId === PRIVATE_EXPERIMENTAL_USER.userId;
}
