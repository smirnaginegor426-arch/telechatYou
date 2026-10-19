import { sql } from "drizzle-orm";
import { getDb } from "../queries/connection";

/**
 * These additive tables are created idempotently so an existing Render deployment
 * can roll out channels and polls without requiring a separate console migration.
 * The same DDL is mirrored in db/migrations/0002_channels_polls.sql for local setups.
 */
export async function ensureCommunitySchema(): Promise<void> {
  const statements = [
    `CREATE TABLE IF NOT EXISTS channels (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      chatId BIGINT UNSIGNED NOT NULL,
      ownerId BIGINT UNSIGNED NOT NULL,
      kind ENUM('channel','group') NOT NULL DEFAULT 'channel',
      username VARCHAR(32) NULL,
      description VARCHAR(280) NOT NULL DEFAULT '',
      isPublic BOOLEAN NOT NULL DEFAULT FALSE,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY channels_chatId_unique (chatId),
      UNIQUE KEY channels_username_unique (username),
      KEY channels_public_idx (isPublic, username),
      KEY channels_owner_idx (ownerId)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS polls (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      messageId BIGINT UNSIGNED NOT NULL,
      chatId BIGINT UNSIGNED NOT NULL,
      creatorId BIGINT UNSIGNED NOT NULL,
      question VARCHAR(500) NOT NULL,
      allowMultiple BOOLEAN NOT NULL DEFAULT FALSE,
      closedAt TIMESTAMP NULL DEFAULT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY polls_messageId_unique (messageId),
      KEY polls_chat_idx (chatId),
      KEY polls_creator_idx (creatorId)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS poll_options (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      pollId BIGINT UNSIGNED NOT NULL,
      text VARCHAR(255) NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY poll_options_poll_idx (pollId)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS poll_votes (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      pollId BIGINT UNSIGNED NOT NULL,
      optionId BIGINT UNSIGNED NOT NULL,
      userId BIGINT UNSIGNED NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY poll_votes_unique (pollId, optionId, userId),
      KEY poll_votes_poll_idx (pollId),
      KEY poll_votes_option_idx (optionId),
      KEY poll_votes_user_idx (userId)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS channel_message_views (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      messageId BIGINT UNSIGNED NOT NULL,
      userId BIGINT UNSIGNED NOT NULL,
      viewedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY channel_message_views_unique (messageId, userId),
      KEY channel_message_views_message_idx (messageId),
      KEY channel_message_views_user_idx (userId)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS channel_message_views (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      messageId BIGINT UNSIGNED NOT NULL,
      userId BIGINT UNSIGNED NOT NULL,
      viewedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY channel_message_views_unique (messageId, userId),
      KEY channel_message_views_message_idx (messageId),
      KEY channel_message_views_user_idx (userId)
    ) ENGINE=InnoDB`,
  ];

  for (const statement of statements {
    await getDb().execute(sql.raw(statement));
  }

  // Existing Render databases may have been created before public groups existed.
  // Try the additive migration on every boot and ignore only MySQL's duplicate-column error.
  try {
    await getDb().execute(sql.raw(
      "ALTER TABLE channels ADD COLUMN kind ENUM('channel','group') NOT NULL DEFAULT 'channel' AFTER ownerId",
    ));
  } catch (error) {
    const cause = error as { code?: string; cause?: { code?: string } };
    const code = cause.code ?? cause.cause?.code;
    if (code !== "ER_DUP_FIELDNAME") throw error;
  }
}
