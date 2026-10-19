CREATE TABLE IF NOT EXISTS alpha_access_keys (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  keyHash VARCHAR(64) NOT NULL,
  keyType ENUM('tester','subscriber') NOT NULL DEFAULT 'tester',
  usedAt TIMESTAMP NULL DEFAULT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY alpha_access_keys_hash_unique (keyHash),
  KEY alpha_access_keys_used_idx (usedAt)
) ENGINE=InnoDB;
