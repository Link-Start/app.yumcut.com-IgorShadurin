ALTER TABLE `VideoAsset`
  ADD COLUMN `variant` VARCHAR(16) NULL;

CREATE INDEX `VideoAsset_projectId_variant_idx` ON `VideoAsset`(`projectId`, `variant`);
