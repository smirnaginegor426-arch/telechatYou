import { sql } from "drizzle-orm";
import { getDb } from "../queries/connection";

/**
 * Create the recovery-secret table idempotently before the app serves requests.
 * The matching SQL migration remains available for local and manually managed setups.
 */
export async function ensureRecoverySecretSchema(): Promise<void> {
  await getDb().execute(sql.raw(`CREATE TABLE IF NOT EXISTS recovery_secrets (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    userId BIGINT UNSIGNED NOT NULL,
    secretHash VARCHAR(64) NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY recovery_secrets_user_unique (userId),
    KEY recovery_secrets_user_idx (userId)
  ) ENGINE=InnoDB`));
}
