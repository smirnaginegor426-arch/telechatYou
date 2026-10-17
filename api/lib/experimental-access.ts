/**
 * Allow the experimental app version only for the designated test accounts.
 * Usernames are checked against the database profile attached to the current
 * authenticated user; a client-supplied username is never trusted.
 *
 * Optional numeric IDs can be configured in the backend environment as
 * TCY_PRIVATE_TESTER_USER_IDS (comma-separated), or with the older singular
 * TCY_PRIVATE_TESTER_USER_ID variable.
 */
import { eq } from "drizzle-orm";
import { profiles } from "@db/schema";
import type { PublicUser } from "./session";
import { getDb } from "../queries/connection";

const PRIVATE_TESTER_USERNAMES = new Set(["teste", "delover"]);

export async function isPrivateExperimentalTester(
  user: Pick<PublicUser, "id"> | null | undefined,
): Promise<boolean> {
  if (!user) return false;

  const configuredIds = (
    process.env.TCY_PRIVATE_TESTER_USER_IDS ??
    process.env.TCY_PRIVATE_TESTER_USER_ID ??
    ""
  )
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isSafeInteger(value) && value > 0);

  if (configuredIds.includes(user.id)) return true;

  try {
    const [profile] = await getDb()
      .select({ username: profiles.username })
      .from(profiles)
      .where(eq(profiles.userId, user.id))
      .limit(1);

    const username = profile?.username?.trim().replace(/^@/, "").toLowerCase();
    return !!username && PRIVATE_TESTER_USERNAMES.has(username);
  } catch {
    // Fail closed: a database/profile lookup failure must not grant preview access.
    return false;
  }
}
