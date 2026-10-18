/**
 * Server-side allowlist for the private experimental TeleChat You build.
 *
 * TCY_PRIVATE_TESTER_USER_ID still wins whenever it is configured, but the
 * private account is also baked in as a fallback: this decision now selects
 * which of the two shipped applications a browser receives (see api/lib/vite.ts),
 * so a missing environment variable must not lock the tester out of the new
 * build. Keep the fallback in sync with src/lib/testers.ts.
 */
import type { PublicUser } from "./session";

const FALLBACK_USERNAME = "teste";
const FALLBACK_USER_ID = 1633623;

function normalizeUsername(username?: string | null) {
  return username?.trim().replace(/^@/, "").toLowerCase();
}

/**
 * The one account that receives the current (experimental) application.
 */
export function isPrivateExperimentalUser(
  user: Pick<PublicUser, "id"> & { username?: string | null } | null | undefined,
): boolean {
  if (!user) return false;

  const configuredId = process.env.TCY_PRIVATE_TESTER_USER_ID?.trim();
  if (configuredId) {
    const allowedUserId = Number(configuredId);
    return Number.isSafeInteger(allowedUserId) && allowedUserId > 0 && user.id === allowedUserId;
  }

  return user.id === FALLBACK_USER_ID && normalizeUsername(user.username) === FALLBACK_USERNAME;
}

/**
 * Back-compat alias used by testerProcedure (the server-side link previews).
 */
export function isPrivateExperimentalTester(
  user: Pick<PublicUser, "id"> & { username?: string | null } | null | undefined,
): boolean {
  return isPrivateExperimentalUser(user);
}
