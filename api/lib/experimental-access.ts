/**
 * Server-side allowlist for private experimental TeleChat You features.
 *
 * Configure TCY_PRIVATE_TESTER_USER_ID in the backend environment rather than
 * committing a personal account identifier to the public repository.
 */
import type { PublicUser } from "./session";

export function isPrivateExperimentalTester(
  user: Pick<PublicUser, "id"> | null | undefined,
): boolean {
  if (!user) return false;
  const configuredId = process.env.TCY_PRIVATE_TESTER_USER_ID?.trim();
  if (!configuredId) return false;

  const allowedUserId = Number(configuredId);
  return Number.isSafeInteger(allowedUserId) && allowedUserId > 0 && user.id === allowedUserId;
}
