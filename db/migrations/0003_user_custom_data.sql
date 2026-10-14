-- Account-persistent sticker libraries and per-user chat folders.
-- Production also creates this table idempotently from api/lib/user-custom-data-schema.ts.
CREATE TABLE IF NOT EXISTS user_custom_data (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  userId BIGINT UNSIGNED NOT NULL,
  stickerPacks LONGTEXT NOT NULL,
  favoriteStickers LONGTEXT NOT NULL,
  chatFolders LONGTEXT NOT NULL,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY user_custom_data_user_unique (userId)
) ENGINE=InnoDB;
