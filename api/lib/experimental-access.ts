/**
 * Grant the unreleased app version only to the explicitly approved account.
 * The authenticated user ID comes from the server-verified session; client
 * supplied IDs and usernames are never trusted.
 */
const PRIVATE_TESTER_USER_IDS = new Set([1633623]);

export async function isPrivateExperimentalTester(
  user: { id: number } | null | undefined,
): Promise<boolean> {
  return !!user && PRIVATE_TESTER_USER_IDS.has(user.id);
}
