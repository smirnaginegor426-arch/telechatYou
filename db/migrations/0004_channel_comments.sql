-- Add channel post comment permission and separate discussion comments.
-- The production boot migration is idempotent; run this file once on local databases.
ALTER TABLE channels
  ADD COLUMN commentsEnabled BOOLEAN NOT NULL DEFAULT FALSE AFTER isPublic;

CREATE TABLE IF NOT EXISTS channel_post_comments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  postId BIGINT UNSIGNED NOT NULL,
  chatId BIGINT UNSIGNED NOT NULL,
  senderId BIGINT UNSIGNED NOT NULL,
  body TEXT NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY channel_post_comments_post_idx (postId, id),
  KEY channel_post_comments_chat_idx (chatId),
  KEY channel_post_comments_sender_idx (senderId)
) ENGINE=InnoDB;
