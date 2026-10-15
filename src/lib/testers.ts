/**
 * Usernames allowed to display the TeleChat You tester badge.
 * Add tester usernames here (with or without "@"); matching is case-insensitive.
 */
const TESTER_USERNAMES: readonly string[] = [];

export function isTesterUsername(username?: string | null): boolean {
  const normalized = username?.trim().replace(/^@/, "").toLowerCase();
  return !!normalized && TESTER_USERNAMES.some(
    (tester) => tester.trim().replace(/^@/, "").toLowerCase() === normalized,
  );
}
