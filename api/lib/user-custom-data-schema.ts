import { sql } from "drizzle-orm";
import { getDb } from "../queries/connection";

function isDuplicateColumnError(error: unknown): boolean {
  const visited = new Set<object>();
  let current: unknown = error;

  // Drizzle may wrap the MySQL error inside one or more cause objects.
  // Inspect the complete chain instead of only the top-level message.
  while (current && typeof current === "object" && !visited.has(current)) {
    visited.add(current);
    const candidate = current as {
      message?: unknown;
      code?: unknown;
      errno?: unknown;
      cause?: unknown;
    };

    if (
      candidate.code === "ER_DUP_FIELDNAME" ||
      Number(candidate.errno) === 1060 ||
      (typeof candidate.message === "string" &&
        /duplicate column name|er_dup_fieldname/i.test(candidate.message))
    ) {
      return true;
    }

    current = candidate.cause;
  }

  return typeof error === "string" &&
    /duplicate column name|er_dup_fieldname/i.test(error);
}

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
    // The column may already exist after a previous or parallel deployment.
    // Ignore only MySQL's duplicate-column error; propagate all other failures.
    if (!isDuplicateColumnError(error)) throw error;
  }

  await getDb().execute(sql.raw("UPDATE user_custom_data SET contactNames = '{}' WHERE contactNames IS NULL"));
}
