CREATE TABLE `ImagePrankSubcategory` (
    `id` CHAR(36) NOT NULL,
    `categoryId` CHAR(36) NOT NULL,
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

CREATE UNIQUE INDEX `ImagePrankSubcategory_categoryId_slug_key` ON `ImagePrankSubcategory`(`categoryId`, `slug`);
CREATE INDEX `ImagePrankSubcategory_categoryId_isActive_priority_createdAt_idx` ON `ImagePrankSubcategory`(`categoryId`, `isActive`, `priority`, `createdAt`);

ALTER TABLE `ImagePrankItem` ADD COLUMN `subcategoryId` CHAR(36) NULL;
CREATE INDEX `ImagePrankItem_subcategoryId_priority_idx` ON `ImagePrankItem`(`subcategoryId`, `priority`);

ALTER TABLE `ImagePrankSubcategory`
  ADD CONSTRAINT `ImagePrankSubcategory_categoryId_fkey`
  FOREIGN KEY (`categoryId`) REFERENCES `ImagePrankCategory`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ImagePrankItem`
  ADD CONSTRAINT `ImagePrankItem_subcategoryId_fkey`
  FOREIGN KEY (`subcategoryId`) REFERENCES `ImagePrankSubcategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
