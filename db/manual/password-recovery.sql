-- Password sign-in and recovery codes for TeleChatYou.
-- Use this if you do not run `npm run db:push`. Safe to run once.

CREATE TABLE IF NOT EXISTS `credentials` (
  `id` SERIAL PRIMARY KEY,
  `userId` BIGINT UNSIGNED NOT NULL UNIQUE,
  `passwordHash` VARCHAR(255) NOT NULL,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `recovery_codes` (
  `id` SERIAL PRIMARY KEY,
  `userId` BIGINT UNSIGNED NOT NULL,
  `codeHash` VARCHAR(64) NOT NULL,
  `attempts` INT NOT NULL DEFAULT 0,
  `expiresAt` TIMESTAMP NOT NULL,
  `usedAt` TIMESTAMP NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `rc_user_idx` (`userId`)
);

ALTER TABLE `settings`
  ADD COLUMN `animations` BOOLEAN NOT NULL DEFAULT TRUE;
