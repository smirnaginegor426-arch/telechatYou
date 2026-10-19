-- Count unique signed-in accounts that have seen each channel post.
CREATE TABLE IF NOT EXISTS channel_message_views (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  messageId BIGINT UNSIGNED NOT NULL,
  userId BIGINT UNSIGNED NOT NULL,
  viewedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY channel_message_views_unique (messageId, userId),
  KEY channel_message_views_message_idx (messageId),
  KEY channel_message_views_user_idx (userId)
) ENGINE=InnoDB;
