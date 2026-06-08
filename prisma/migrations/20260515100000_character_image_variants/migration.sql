CREATE TABLE `CharacterImageVariant` (
  `id` CHAR(36) NOT NULL,
  `characterVariationId` CHAR(36) NOT NULL,
  `kind` VARCHAR(32) NOT NULL,
  `height` INTEGER NOT NULL,
  `width` INTEGER NULL,
  `path` VARCHAR(512) NOT NULL,
  `url` VARCHAR(512) NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'ready',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `CharacterImageVariant_characterVariationId_kind_height_key` ON `CharacterImageVariant`(`characterVariationId`, `kind`, `height`);
CREATE INDEX `CharacterImageVariant_kind_height_idx` ON `CharacterImageVariant`(`kind`, `height`);

ALTER TABLE `CharacterImageVariant` ADD CONSTRAINT `CharacterImageVariant_characterVariationId_fkey` FOREIGN KEY (`characterVariationId`) REFERENCES `CharacterVariation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
