/**
 * Accounts allowed to display the TeleChat You tester badge.
 * Both username and numeric user ID must match.
 */
const TESTERS = [
  { username: "artemizzz", userId: 848009 },
  { username: "amongopin", userId: 1573622 },
] as const;

export function isTesterUsername(
  username?: string | null,
  userId?: number | string | null,
): boolean {
  const normalized = username?.trim().replace(/^@/, "").toLowerCase();
  const normalizedUserId = userId == null || userId === "" ? NaN : Number(userId);

  return !!normalized &&
    Number.isSafeInteger(normalizedUserId) &&
    TESTERS.some(
      (tester) =>
        tester.username === normalized &&
        tester.userId === normalizedUserId,
    );
}
