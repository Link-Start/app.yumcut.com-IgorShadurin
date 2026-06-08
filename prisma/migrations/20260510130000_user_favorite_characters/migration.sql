CREATE TABLE `UserFavoriteCharacter` (
  `userId` CHAR(36) NOT NULL,
  `characterId` CHAR(36) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`userId`, `characterId`),
  INDEX `UserFavoriteCharacter_characterId_createdAt_idx`(`characterId`, `createdAt`),
  CONSTRAINT `UserFavoriteCharacter_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `UserFavoriteCharacter_characterId_fkey`
    FOREIGN KEY (`characterId`) REFERENCES `Character`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
