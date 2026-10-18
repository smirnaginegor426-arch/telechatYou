/**
 * Server-side access rule for the private current TeleChat You build.
 * Access is tied only to the server-verified numeric account ID.
 * Usernames and client-supplied identity fields are not authorization inputs.
 */
import type { PublicUser } from "./session";

type CandidateUser = Pick<PublicUser, "id"> | null | undefined;
const PRIVATE_TESTER_USER_ID = 1633623;

export type PrivateExperimentalMatch = "user-id" | "none";

/** Explain whether this authenticated account receives the current build. */
export function privateExperimentalMatch(user: CandidateUser): PrivateExperimentalMatch {
  return user && Number.isSafeInteger(user.id) && user.id === PRIVATE_TESTER_USER_ID
    ? "user-id"
    : "none";
}

/** The current application is served only to the single approved account. */
export function isPrivateExperimentalUser(user: CandidateUser): boolean {
  return privateExperimentalMatch(user) !== "none";
}

/** Back-compat alias used by the experimental-access API endpoint. */
export function isPrivateExperimentalTester(user: CandidateUser): boolean {
  return isPrivateExperimentalUser(user);
}
