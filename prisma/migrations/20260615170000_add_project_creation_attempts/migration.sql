-- CreateTable
CREATE TABLE `UserAttribution` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `firstUtmSource` VARCHAR(200) NULL,
    `lastUtmSource` VARCHAR(200) NULL,
    `firstReferrerOrigin` VARCHAR(255) NULL,
    `firstReferrerPath` VARCHAR(512) NULL,
    `lastReferrerOrigin` VARCHAR(255) NULL,
    `lastReferrerPath` VARCHAR(512) NULL,
    `firstLandingPath` VARCHAR(512) NULL,
    `lastLandingPath` VARCHAR(512) NULL,
    `firstSourceToolSlug` VARCHAR(191) NULL,
    `lastSourceToolSlug` VARCHAR(191) NULL,
    `firstIntent` VARCHAR(32) NULL,
    `lastIntent` VARCHAR(32) NULL,
    `firstProjectPrompt` LONGTEXT NULL,
    `firstProjectPromptMode` VARCHAR(16) NULL,
    `firstProjectExperience` VARCHAR(32) NULL,
    `firstMainPageMode` VARCHAR(32) NULL,
    `firstMainPageCategoryId` VARCHAR(64) NULL,
    `firstCharacterSlug` VARCHAR(191) NULL,
    `firstTemplateId` CHAR(36) NULL,
    `firstProjectAttemptId` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `UserAttribution_userId_key`(`userId`),
    INDEX `UserAttribution_firstUtmSource_idx`(`firstUtmSource`),
    INDEX `UserAttribution_lastUtmSource_idx`(`lastUtmSource`),
    INDEX `UserAttribution_firstSourceToolSlug_idx`(`firstSourceToolSlug`),
    INDEX `UserAttribution_firstCharacterSlug_idx`(`firstCharacterSlug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProjectCreationAttempt` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `projectId` CHAR(36) NULL,
    `clientAttemptId` VARCHAR(64) NOT NULL,
    `result` VARCHAR(32) NOT NULL,
    `promptText` LONGTEXT NULL,
    `promptMode` VARCHAR(16) NULL,
    `projectExperience` VARCHAR(32) NULL,
    `durationSeconds` INTEGER NULL,
    `tokenCost` INTEGER NULL,
    `tokenBalance` INTEGER NULL,
    `mainPageMode` VARCHAR(32) NULL,
    `mainPageCategoryId` VARCHAR(64) NULL,
    `characterSlug` VARCHAR(191) NULL,
    `templateId` CHAR(36) NULL,
    `utmSource` VARCHAR(200) NULL,
    `utmMedium` VARCHAR(200) NULL,
    `utmCampaign` VARCHAR(200) NULL,
    `utmContent` VARCHAR(200) NULL,
    `utmTerm` VARCHAR(200) NULL,
    `intent` VARCHAR(32) NULL,
    `sourceToolSlug` VARCHAR(191) NULL,
    `referrerOrigin` VARCHAR(255) NULL,
    `referrerPath` VARCHAR(512) NULL,
    `landingPath` VARCHAR(512) NULL,
    `query` JSON NULL,
    `languageCodes` JSON NULL,
    `languageVoices` JSON NULL,
    `settingsSnapshot` JSON NULL,
    `rawContext` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProjectCreationAttempt_userId_clientAttemptId_key`(`userId`, `clientAttemptId`),
    INDEX `ProjectCreationAttempt_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `ProjectCreationAttempt_projectId_idx`(`projectId`),
    INDEX `ProjectCreationAttempt_result_createdAt_idx`(`result`, `createdAt`),
    INDEX `ProjectCreationAttempt_utmSource_idx`(`utmSource`),
    INDEX `ProjectCreationAttempt_sourceToolSlug_idx`(`sourceToolSlug`),
    INDEX `ProjectCreationAttempt_characterSlug_idx`(`characterSlug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserAttribution` ADD CONSTRAINT `UserAttribution_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectCreationAttempt` ADD CONSTRAINT `ProjectCreationAttempt_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectCreationAttempt` ADD CONSTRAINT `ProjectCreationAttempt_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
