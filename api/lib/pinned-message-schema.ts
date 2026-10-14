import { sql } from "drizzle-orm";
import { getDb } from "../queries/connection";

/** Additive pinned-message table, created before the production API starts serving. */
export async function ensurePinnedMessageSchema(): Promise<void> {
  await getDb().execute(sql.raw(`CREATE TABLE IF NOT EXISTS pinned_messages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    chatId BIGINT UNSIGNED NOT NULL,
    messageId BIGINT UNSIGNED NOT NULL,
    pinnedBy BIGINT UNSIGNED NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY pinned_messages_chat_unique (chatId),
    KEY pinned_messages_message_idx (messageId),
    KEY pinned_messages_user_idx (pinnedBy)
  ) ENGINE=InnoDB`));

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
