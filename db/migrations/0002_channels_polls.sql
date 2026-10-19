-- Additive community features: channels and polls. Safe to run more than once.
CREATE TABLE IF NOT EXISTS channels (
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
) ENGINE=InnoDB;

-- Existing deployments may have a role enum without "owner", which is required
-- when creating a channel/group. Widening it preserves existing owner/admin/member rows.
ALTER TABLE chat_members
  MODIFY COLUMN role ENUM('owner','admin','member') NOT NULL DEFAULT 'member';

CREATE TABLE IF NOT EXISTS polls (
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
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS poll_options (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  pollId BIGINT UNSIGNED NOT NULL,
  text VARCHAR(255) NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY poll_options_poll_idx (pollId)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS poll_votes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  pollId BIGINT UNSIGNED NOT NULL,
  optionId BIGINT UNSIGNED NOT NULL,
  userId BIGINT UNSIGNED NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY poll_votes_unique (pollId, optionId, userId),
  KEY poll_votes_poll_idx (pollId),
  KEY poll_votes_option_idx (optionId),
  KEY poll_votes_user_idx (userId)
) ENGINE=InnoDB;
