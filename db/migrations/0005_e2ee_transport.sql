-- E2EE transport foundation for the current TeleChat You server.
-- This stores public device keys and opaque to-device payloads only.
-- Private cryptographic keys must never be stored by the server.
CREATE TABLE IF NOT EXISTS e2ee_devices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  userId BIGINT UNSIGNED NOT NULL,
  deviceId VARCHAR(64) NOT NULL,
  deviceKeys LONGTEXT NOT NULL,
  displayName VARCHAR(96) NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  revokedAt TIMESTAMP NULL,
  UNIQUE KEY e2ee_devices_user_device_uniq (userId, deviceId),
  KEY e2ee_devices_user_idx (userId),
  KEY e2ee_devices_revoked_idx (revokedAt)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS e2ee_one_time_keys (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  userId BIGINT UNSIGNED NOT NULL,
  deviceId VARCHAR(64) NOT NULL,
  algorithm VARCHAR(64) NOT NULL,
  keyId VARCHAR(160) NOT NULL,
  keyData LONGTEXT NOT NULL,
  isFallback BOOLEAN NOT NULL DEFAULT FALSE,
  claimedAt TIMESTAMP NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY e2ee_one_time_keys_uniq (userId, deviceId, keyId),
  KEY e2ee_one_time_keys_lookup_idx (userId, deviceId, algorithm, claimedAt)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS e2ee_to_device_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  senderUserId BIGINT UNSIGNED NOT NULL,
  recipientUserId BIGINT UNSIGNED NOT NULL,
  recipientDeviceId VARCHAR(64) NOT NULL,
  eventType VARCHAR(128) NOT NULL,
  content LONGTEXT NOT NULL,
  transactionId VARCHAR(128) NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acknowledgedAt TIMESTAMP NULL,
  UNIQUE KEY e2ee_to_device_txn_uniq (senderUserId, transactionId, recipientUserId, recipientDeviceId),
  KEY e2ee_to_device_recipient_idx (recipientUserId, recipientDeviceId, acknowledgedAt, id)
) ENGINE=InnoDB;
