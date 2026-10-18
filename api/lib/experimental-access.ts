/**
 * Server-side allowlist for the private current TeleChat You build.
 * Only the account ID verified from the active server session is trusted.
 */
import type { PublicUser } from "./session";

const PRIVATE_EXPERIMENTAL_USER_ID = 1633623;

export type PrivateExperimentalMatch = "user-id" | "none";

type CandidateUser = Pick<PublicUser, "id"> | null | undefined;

/** Whether this authenticated account receives the current application. */
export function privateExperimentalMatch(user: CandidateUser): PrivateExperimentalMatch {
  return user &&
    Number.isSafeInteger(user.id) &&
    user.id === PRIVATE_EXPERIMENTAL_USER_ID
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
