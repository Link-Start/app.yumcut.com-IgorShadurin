CREATE TABLE `AdminApiKey` (
  `id` CHAR(36) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `tokenHash` CHAR(64) NOT NULL,
  `tokenPrefix` VARCHAR(16) NOT NULL,
  `scopes` JSON NULL,
  `createdByUserId` CHAR(36) NOT NULL,
  `revokedByUserId` CHAR(36) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `revokedAt` DATETIME(3) NULL,
  `lastUsedAt` DATETIME(3) NULL,
  `lastUsedIp` VARCHAR(64) NULL,
  `lastUsedUserAgent` VARCHAR(512) NULL,

  UNIQUE INDEX `AdminApiKey_tokenHash_key`(`tokenHash`),
  INDEX `AdminApiKey_createdByUserId_createdAt_idx`(`createdByUserId`, `createdAt`),
  INDEX `AdminApiKey_revokedAt_idx`(`revokedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `InboundFeedback` (
  `id` CHAR(36) NOT NULL,
  `emailId` VARCHAR(191) NOT NULL,
  `fromEmail` VARCHAR(320) NULL,
  `fromRaw` VARCHAR(512) NULL,
  `toRecipients` JSON NULL,
  `subject` VARCHAR(512) NULL,
  `latestReplyText` LONGTEXT NULL,
  `snippetSource` VARCHAR(16) NOT NULL DEFAULT 'none',
  `userId` CHAR(36) NULL,
  `replyBonus` JSON NULL,
  `inboundFetchError` TEXT NULL,
  `telegramForwardError` TEXT NULL,
  `enriched` BOOLEAN NOT NULL DEFAULT false,
  `forwardedToTelegram` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `InboundFeedback_emailId_key`(`emailId`),
  INDEX `InboundFeedback_createdAt_idx`(`createdAt`),
  INDEX `InboundFeedback_userId_createdAt_idx`(`userId`, `createdAt`),
  INDEX `InboundFeedback_fromEmail_idx`(`fromEmail`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AdminApiKey`
  ADD CONSTRAINT `AdminApiKey_createdByUserId_fkey`
  FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `AdminApiKey`
  ADD CONSTRAINT `AdminApiKey_revokedByUserId_fkey`
  FOREIGN KEY (`revokedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `InboundFeedback`
  ADD CONSTRAINT `InboundFeedback_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
