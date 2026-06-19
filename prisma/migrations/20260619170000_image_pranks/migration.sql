CREATE TABLE `ImagePrankCategory` (
  `id` CHAR(36) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `titleEn` VARCHAR(191) NOT NULL,
  `titleRu` VARCHAR(191) NOT NULL,
  `subtitleEn` VARCHAR(255) NULL,
  `subtitleRu` VARCHAR(255) NULL,
  `descriptionEn` TEXT NULL,
  `descriptionRu` TEXT NULL,
  `searchTextEn` TEXT NULL,
  `searchTextRu` TEXT NULL,
  `priority` INTEGER NOT NULL DEFAULT 0,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `ImagePrankCategory_slug_key` ON `ImagePrankCategory`(`slug`);
CREATE INDEX `ImagePrankCategory_isActive_priority_createdAt_idx` ON `ImagePrankCategory`(`isActive`, `priority`, `createdAt`);

CREATE TABLE `ImagePrankItem` (
  `id` CHAR(36) NOT NULL,
  `categoryId` CHAR(36) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `titleEn` VARCHAR(191) NOT NULL,
  `titleRu` VARCHAR(191) NOT NULL,
  `descriptionEn` VARCHAR(300) NULL,
  `descriptionRu` VARCHAR(300) NULL,
  `searchTextEn` TEXT NULL,
  `searchTextRu` TEXT NULL,
  `imagePath` VARCHAR(512) NOT NULL,
  `imageUrl` VARCHAR(512) NULL,
  `priority` INTEGER NOT NULL DEFAULT 0,
  `isPublic` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `ImagePrankItem_slug_key` ON `ImagePrankItem`(`slug`);
CREATE INDEX `ImagePrankItem_categoryId_priority_idx` ON `ImagePrankItem`(`categoryId`, `priority`);
CREATE INDEX `ImagePrankItem_isPublic_priority_createdAt_idx` ON `ImagePrankItem`(`isPublic`, `priority`, `createdAt`);
ALTER TABLE `ImagePrankItem` ADD CONSTRAINT `ImagePrankItem_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ImagePrankCategory`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
