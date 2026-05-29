CREATE TABLE `ProjectArtifact` (
  `id` CHAR(36) NOT NULL,
  `projectId` CHAR(36) NOT NULL,
  `kind` VARCHAR(32) NOT NULL,
  `variant` VARCHAR(64) NULL,
  `path` VARCHAR(191) NOT NULL,
  `publicUrl` VARCHAR(512) NULL,
  `localPath` TEXT NULL,
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `ProjectArtifact_projectId_idx`(`projectId`),
  INDEX `ProjectArtifact_projectId_kind_idx`(`projectId`, `kind`),
  INDEX `ProjectArtifact_projectId_variant_idx`(`projectId`, `variant`),
  CONSTRAINT `ProjectArtifact_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
