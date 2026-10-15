import { sql } from "drizzle-orm";
import { getDb } from "../queries/connection";

/**
 * Account collections are created additively at startup so existing production
 * databases can be updated without a separate manual migration step.
 */
export async function ensureUserCustomDataSchema(): Promise<void> {
  await getDb().execute(sql.raw(`CREATE TABLE IF NOT EXISTS user_custom_data (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    userId BIGINT UNSIGNED NOT NULL,
    stickerPacks LONGTEXT NOT NULL,
    favoriteStickers LONGTEXT NOT NULL,
    chatFolders LONGTEXT NOT NULL,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY user_custom_data_user_unique (userId)
  ) ENGINE=InnoDB`));

  try {
    await getDb().execute(sql.raw("ALTER TABLE user_custom_data ADD COLUMN contactNames LONGTEXT NULL"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/duplicate column name|ER_DUP_FIELDNAME/i.test(message)) throw error;
  }
  await getDb().execute(sql.raw("UPDATE user_custom_data SET contactNames = '{}' WHERE contactNames IS NULL"));
}
