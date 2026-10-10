-- Apply only to an existing TeleChatYou database that already has the original Kimi-auth schema.
-- For an empty database, prefer `npm run db:push` instead of this migration.
ALTER TABLE users
  ADD COLUMN username VARCHAR(32) NULL,
  ADD COLUMN passwordHash VARCHAR(255) NULL,
  MODIFY COLUMN unionId VARCHAR(255) NULL;

UPDATE users SET username = CONCAT('legacy_', id) WHERE username IS NULL;
ALTER TABLE users MODIFY COLUMN username VARCHAR(32) NOT NULL;
CREATE UNIQUE INDEX users_username_unique ON users (username);

CREATE TABLE sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  userId BIGINT UNSIGNED NOT NULL,
  tokenHash VARCHAR(64) NOT NULL,
  expiresAt TIMESTAMP NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip VARCHAR(64) NULL,
  userAgent VARCHAR(512) NULL,
  UNIQUE KEY sessions_tokenHash_unique (tokenHash),
  KEY sessions_user_idx (userId),
  KEY sessions_expires_idx (expiresAt)
) ENGINE=InnoDB;
