import { sql } from "drizzle-orm";
import { getDb } from "../queries/connection";

function isDuplicateColumnError(error: unknown): boolean {
  const visited = new Set<object>();
  let current: unknown = error;
  while (current && typeof current === "object" && !visited.has(current)) {
    visited.add(current);
    const candidate = current as {
      code?: unknown;
      errno?: unknown;
      message?: unknown;
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
      commentsEnabled BOOLEAN NOT NULL DEFAULT FALSE,
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
    `CREATE TABLE IF NOT EXISTS channel_post_comments (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      postId BIGINT UNSIGNED NOT NULL,
      chatId BIGINT UNSIGNED NOT NULL,
      senderId BIGINT UNSIGNED NOT NULL,
      body TEXT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY channel_post_comments_post_idx (postId, id),
      KEY channel_post_comments_chat_idx (chatId),
      KEY channel_post_comments_sender_idx (senderId)
    ) ENGINE=InnoDB`,
  ];

  for (const statement of statements) {
    await getDb().execute(sql.raw(statement));
  }

  // Existing Render databases may predate the channel kind/comments columns.
  // Ignore duplicate-column errors even when Drizzle/TiDB wraps them several levels deep.
  await addColumnIfMissing(
    "ALTER TABLE channels ADD COLUMN kind ENUM('channel','group') NOT NULL DEFAULT 'channel' AFTER ownerId",
  );
  await addColumnIfMissing(
    "ALTER TABLE channels ADD COLUMN commentsEnabled BOOLEAN NOT NULL DEFAULT FALSE AFTER isPublic",
  );

  // A channel/group creator is stored in chat_members.role. Older deployments may
  // have an enum that does not allow "owner", causing create channel/group to fail.
  // Expanding the enum preserves current rows and makes this migration idempotent.
  await getDb().execute(sql.raw(
    "ALTER TABLE chat_members MODIFY COLUMN role ENUM('owner','admin','member') NOT NULL DEFAULT 'member'",
  ));
}
