import { sql } from "drizzle-orm";
import { getDb } from "../queries/connection";

function isDuplicateColumnError(error: unknown): boolean {
  const visited = new Set<object>();
  let current: unknown = error;
  while (current && typeof current === "object" && !visited.has(current)) {
    visited.add(current);
    const candidate = current as { code?: unknown; errno?: unknown; message?: unknown; cause?: unknown };
    if (
      candidate.code === "ER_DUP_FIELDNAME" ||
      Number(candidate.errno) === 1060 ||
      (typeof candidate.message === "string" && /duplicate column name|er_dup_fieldname/i.test(candidate.message))
    ) return true;
    current = candidate.cause;
  }
  return typeof error === "string" && /duplicate column name|er_dup_fieldname/i.test(error);
}

async function addColumnIfMissing(statement: string): Promise<void> {
  try {
    await getDb().execute(sql.raw(statement));
  } catch (error) {
    if (!isDuplicateColumnError(error)) throw error;
  }
}

/**
 * Keep shared pinned-message metadata compatible with both historic database
 * layouts: older builds used userId, while newer builds used pinnedBy. Both
 * nullable columns are kept temporarily so old and new server bundles can
 * read/write pins safely during rolling deployments.
 */
export async function ensurePinnedMessageSchema(): Promise<void> {
  await getDb().execute(sql.raw(`CREATE TABLE IF NOT EXISTS pinned_messages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    chatId BIGINT UNSIGNED NOT NULL,
    messageId BIGINT UNSIGNED NOT NULL,
    userId BIGINT UNSIGNED NULL,
    pinnedBy BIGINT UNSIGNED NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY pinned_messages_chat_unique (chatId),
    KEY pinned_messages_message_idx (messageId),
    KEY pinned_messages_user_idx (pinnedBy)
  ) ENGINE=InnoDB`));

  // CREATE TABLE IF NOT EXISTS does not evolve a table created by a previous build.
  await addColumnIfMissing(
    "ALTER TABLE pinned_messages ADD COLUMN userId BIGINT UNSIGNED NULL",
  );
  await addColumnIfMissing(
    "ALTER TABLE pinned_messages ADD COLUMN pinnedBy BIGINT UNSIGNED NULL",
  );

  // Backfill the counterpart for existing rows without overwriting either value.
  await getDb().execute(sql.raw(
    "UPDATE pinned_messages SET userId = COALESCE(userId, pinnedBy), pinnedBy = COALESCE(pinnedBy, userId) WHERE userId IS NULL OR pinnedBy IS NULL",
  ));

  await getDb().execute(sql.raw(`CREATE TABLE IF NOT EXISTS personal_pinned_messages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    chatId BIGINT UNSIGNED NOT NULL,
    userId BIGINT UNSIGNED NOT NULL,
    messageId BIGINT UNSIGNED NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY personal_pinned_chat_user_uniq (chatId, userId),
    KEY personal_pinned_message_idx (messageId),
    KEY personal_pinned_user_idx (userId)
  ) ENGINE=InnoDB`));
}
