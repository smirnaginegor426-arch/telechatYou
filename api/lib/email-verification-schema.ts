import { sql } from "drizzle-orm";
import { getDb } from "../queries/connection";

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
    const dbError = error as { code?: string; message?: string };
    if (
      dbError.code !== "ER_DUP_FIELDNAME" &&
      !dbError.message?.toLowerCase().includes("duplicate column")
    ) {
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
