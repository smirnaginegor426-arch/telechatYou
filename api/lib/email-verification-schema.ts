import { sql } from "drizzle-orm";
import { getDb } from "../queries/connection";

/**
 * Drizzle wraps the driver error in DrizzleQueryError, so MySQL's code may
 * be nested under `cause` instead of being present on the top-level error.
 */
function isDuplicateColumnError(error: unknown): boolean {
  const pending: unknown[] = [error];
  const visited = new Set<object>();

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || typeof current !== "object") continue;
    if (visited.has(current)) continue;
    visited.add(current);

    const candidate = current as {
      code?: unknown;
      errno?: unknown;
      message?: unknown;
      sqlMessage?: unknown;
      cause?: unknown;
    };

    if (candidate.code === "ER_DUP_FIELDNAME" || candidate.errno === 1060) {
      return true;
    }

    const messages = [candidate.message, candidate.sqlMessage];
    if (messages.some(
      (message) => typeof message === "string" && /duplicate column name|duplicate column/i.test(message),
    )) {
      return true;
    }

    if (candidate.cause && typeof candidate.cause === "object") {
      pending.push(candidate.cause);
    }
  }

  return false;
}

/**
 * Ensure the email confirmation column and one-time-code table exist before
 * the production API begins accepting account recovery requests.
 */
export async function ensureEmailVerificationSchema(): Promise<void> {
  try {
    await getDb().execute(sql.raw(
      "ALTER TABLE users ADD COLUMN emailVerifiedAt TIMESTAMP NULL",
    ));
  } catch (error) {
    // A migration or an earlier boot may already have added the column.
    // Ignore only the duplicate-column error; all other DB failures must stop startup.
    if (!isDuplicateColumnError(error)) {
      throw error;
    }
  }

  await getDb().execute(sql.raw(`CREATE TABLE IF NOT EXISTS email_verification_codes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    userId BIGINT UNSIGNED NOT NULL,
    email VARCHAR(320) NOT NULL,
    purpose ENUM('link', 'password_reset') NOT NULL,
    codeHash VARCHAR(64) NOT NULL,
    expiresAt TIMESTAMP NOT NULL,
    usedAt TIMESTAMP NULL,
    attempts INT NOT NULL DEFAULT 0,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY email_verification_codes_user_idx (userId, purpose),
    KEY email_verification_codes_email_idx (email, purpose),
    KEY email_verification_codes_expiry_idx (expiresAt)
  ) ENGINE=InnoDB`));
}
