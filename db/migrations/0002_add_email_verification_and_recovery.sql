ALTER TABLE `users`
  ADD COLUMN `emailVerifiedAt` timestamp NULL;

CREATE TABLE `email_verification_codes` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `userId` bigint unsigned NOT NULL,
  `email` varchar(320) NOT NULL,
  `purpose` enum('link','password_reset') NOT NULL,
  `codeHash` varchar(64) NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `usedAt` timestamp NULL,
  `attempts` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `email_verification_codes_user_idx` (`userId`, `purpose`),
  KEY `email_verification_codes_email_idx` (`email`, `purpose`),
  KEY `email_verification_codes_expiry_idx` (`expiresAt`)
);
