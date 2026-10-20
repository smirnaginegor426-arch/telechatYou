import { sql } from "drizzle-orm";
import { getDb } from "../queries/connection";

/**
 * Create the file ownership registry before the API starts serving uploads.
 * The table is declared in db/schema.ts; production startup needs the matching
 * DDL because Render does not automatically run Drizzle migrations on deploy.
 */
export async function ensureFilesSchema(): Promise<void> {
  await getDb().execute(sql.raw(`CREATE TABLE IF NOT EXISTS files (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    \`key\` VARCHAR(255) NOT NULL,
    ownerId BIGINT UNSIGNED NOT NULL,
    name VARCHAR(255) NOT NULL,
    size BIGINT NOT NULL,
    contentType VARCHAR(128) NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY files_key_unique (\`key\`),
    KEY files_owner_idx (ownerId)
  ) ENGINE=InnoDB`));
}
