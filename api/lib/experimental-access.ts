/**
 * Server-side allowlist for the private experimental TeleChat You build.
 *
 * This decides which of the two shipped applications a browser receives
 * (see api/lib/vite.ts), so it must be generous with the private account and
 * narrow with everybody else.
 *
 * The rule is a union, checked in this order:
 *   1. the username/ID pair baked in below (same pair the client UI uses);
 *   2. TCY_PRIVATE_TESTER_USER_ID, when it is configured.
 *
 * The union matters: a stale or wrong environment value used to *replace* the
 * username/ID check, which silently locked the private account out of the new
 * build. Keep the fallback in sync with src/lib/testers.ts.
 */
import type { PublicUser } from "./session";

const FALLBACK_USERNAME = "teste";
const FALLBACK_USER_ID = 1633623;

export type PrivateExperimentalMatch = "username+id" | "env" | "none";

type CandidateUser = (Pick<PublicUser, "id"> & { username?: string | null }) | null | undefined;

function normalizeUsername(username?: string | null) {
  return username?.trim().replace(/^@/, "").toLowerCase();
}

/** Why (or why not) this account gets the current build. */
export function privateExperimentalMatch(user: CandidateUser): PrivateExperimentalMatch {
  if (!user) return "none";

  if (user.id === FALLBACK_USER_ID && normalizeUsername(user.username) === FALLBACK_USERNAME) {
    return "username+id";
  }

  const configuredId = process.env.TCY_PRIVATE_TESTER_USER_ID?.trim();
  if (configuredId) {
    const allowedUserId = Number(configuredId);
    if (Number.isSafeInteger(allowedUserId) && allowedUserId > 0 && user.id === allowedUserId) {
      return "env";
    }
  }

  return "none";
}

/** The one account that receives the current (experimental) application. */
export function isPrivateExperimentalUser(user: CandidateUser): boolean {
  return privateExperimentalMatch(user) !== "none";
}

/** Back-compat alias used by testerProcedure (the server-side link previews). */
export function isPrivateExperimentalTester(user: CandidateUser): boolean {
  return isPrivateExperimentalUser(user);
}
