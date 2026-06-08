ALTER TABLE `User`
  ADD COLUMN `emailReplyBonusGrantedAt` DATETIME(3) NULL,
  ADD COLUMN `emailReplyBonusSourceId` VARCHAR(191) NULL;
