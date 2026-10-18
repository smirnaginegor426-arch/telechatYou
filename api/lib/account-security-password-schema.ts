import { sql } from "drizzle-orm";
import { getDb } from "../queries/connection";

/** Create the hashed account security-password store before it is used. */
export async function ensureAccountSecurityPasswordSchema(): Promise<void> {
  await getDb().execute(sql.raw(`CREATE TABLE IF NOT EXISTS account_security_passwords (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    userId BIGINT UNSIGNED NOT NULL,
    passwordType ENUM('digital', 'graphical') NOT NULL,
    passwordHash VARCHAR(255) NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY account_security_passwords_user_unique (userId)
  ) ENGINE=InnoDB`));
}
