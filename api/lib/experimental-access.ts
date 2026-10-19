/**
 * Server-side allowlist for the private current TeleChat You build.
 * Only account IDs verified from the active server session are trusted.
 */
import type { PublicUser } from "./session";

const PRIVATE_EXPERIMENTAL_USER_IDS = new Set<number>([
  1633623,
  848009, // @artemizzz — tester ID 848009
  3838382, // @bank — tester ID 3838382
]);

export type PrivateExperimentalMatch = "user-id" | "none";

type CandidateUser = Pick<PublicUser, "id"> | null | undefined;

/** Whether this authenticated account receives the current application. */
export function privateExperimentalMatch(user: CandidateUser): PrivateExperimentalMatch {
  return user &&
    Number.isSafeInteger(user.id) &&
    PRIVATE_EXPERIMENTAL_USER_IDS.has(user.id)
    ? "user-id"
    : "none";
}

export function isPrivateExperimentalUser(user: CandidateUser): boolean {
  return privateExperimentalMatch(user) !== "none";
}

/** Back-compat alias used by the experimental-access API endpoint. */
export function isPrivateExperimentalTester(user: CandidateUser): boolean {
  return isPrivateExperimentalUser(user);
}
