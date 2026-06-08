-- AlterTable
ALTER TABLE `Character`
    ADD COLUMN `slug` VARCHAR(191) NULL,
    ADD COLUMN `name` VARCHAR(191) NULL,
    ADD COLUMN `tagline` VARCHAR(255) NULL,
    ADD COLUMN `bio` TEXT NULL,
    ADD COLUMN `searchTextEn` TEXT NULL,
    ADD COLUMN `searchTextRu` TEXT NULL,
    ADD COLUMN `priority` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `previewVideoUrl` VARCHAR(512) NULL,
    ADD COLUMN `isCatalogPublic` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `defaultVoiceId` VARCHAR(128) NULL,
    ADD COLUMN `defaultVoiceProvider` VARCHAR(32) NULL,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `CharacterVariation`
    ADD COLUMN `priority` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `CharacterCategory` (
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
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CharacterCategory_slug_key`(`slug`),
    INDEX `CharacterCategory_isActive_priority_createdAt_idx`(`isActive`, `priority`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CharacterCategoryCharacter` (
    `categoryId` CHAR(36) NOT NULL,
    `characterId` CHAR(36) NOT NULL,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CharacterCategoryCharacter_characterId_priority_idx`(`characterId`, `priority`),
    INDEX `CharacterCategoryCharacter_categoryId_priority_idx`(`categoryId`, `priority`),
    PRIMARY KEY (`categoryId`, `characterId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Character_slug_key` ON `Character`(`slug`);

-- CreateIndex
CREATE INDEX `Character_isCatalogPublic_priority_createdAt_idx` ON `Character`(`isCatalogPublic`, `priority`, `createdAt`);

-- CreateIndex
CREATE INDEX `CharacterVariation_characterId_priority_idx` ON `CharacterVariation`(`characterId`, `priority`);

-- AddForeignKey
ALTER TABLE `CharacterCategoryCharacter` ADD CONSTRAINT `CharacterCategoryCharacter_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `CharacterCategory`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CharacterCategoryCharacter` ADD CONSTRAINT `CharacterCategoryCharacter_characterId_fkey` FOREIGN KEY (`characterId`) REFERENCES `Character`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
