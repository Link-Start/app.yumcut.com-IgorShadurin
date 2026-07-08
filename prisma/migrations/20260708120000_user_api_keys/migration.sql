CREATE TABLE `UserApiKey` (
  `id` CHAR(36) NOT NULL,
  `userId` CHAR(36) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `tokenHash` CHAR(64) NOT NULL,
  `tokenPrefix` VARCHAR(16) NOT NULL,
  `scopes` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `revokedAt` DATETIME(3) NULL,
  `lastUsedAt` DATETIME(3) NULL,
  `lastUsedIp` VARCHAR(64) NULL,
  `lastUsedUserAgent` VARCHAR(512) NULL,

  UNIQUE INDEX `UserApiKey_tokenHash_key`(`tokenHash`),
  INDEX `UserApiKey_userId_createdAt_idx`(`userId`, `createdAt`),
  INDEX `UserApiKey_revokedAt_idx`(`revokedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `UserApiOperation` (
  `id` CHAR(36) NOT NULL,
  `keyId` CHAR(36) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `action` VARCHAR(64) NOT NULL,
  `bodyHash` CHAR(64) NOT NULL,
  `result` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `UserApiOperation_keyId_idempotencyKey_key`(`keyId`, `idempotencyKey`),
  INDEX `UserApiOperation_action_createdAt_idx`(`action`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `UserApiKey`
  ADD CONSTRAINT `UserApiKey_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `UserApiOperation`
  ADD CONSTRAINT `UserApiOperation_keyId_fkey`
  FOREIGN KEY (`keyId`) REFERENCES `UserApiKey`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
