SET @planned_email_subject_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `PlannedEmail` ADD COLUMN `subject` VARCHAR(512) NULL',
    'ALTER TABLE `PlannedEmail` MODIFY COLUMN `subject` VARCHAR(512) NULL'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'PlannedEmail'
    AND COLUMN_NAME = 'subject'
);
PREPARE planned_email_subject_stmt FROM @planned_email_subject_sql;
EXECUTE planned_email_subject_stmt;
DEALLOCATE PREPARE planned_email_subject_stmt;

SET @planned_email_text_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `PlannedEmail` ADD COLUMN `text` LONGTEXT NULL',
    'ALTER TABLE `PlannedEmail` MODIFY COLUMN `text` LONGTEXT NULL'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'PlannedEmail'
    AND COLUMN_NAME = 'text'
);
PREPARE planned_email_text_stmt FROM @planned_email_text_sql;
EXECUTE planned_email_text_stmt;
DEALLOCATE PREPARE planned_email_text_stmt;

SET @planned_email_metadata_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `PlannedEmail` ADD COLUMN `metadata` JSON NULL',
    'ALTER TABLE `PlannedEmail` MODIFY COLUMN `metadata` JSON NULL'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'PlannedEmail'
    AND COLUMN_NAME = 'metadata'
);
PREPARE planned_email_metadata_stmt FROM @planned_email_metadata_sql;
EXECUTE planned_email_metadata_stmt;
DEALLOCATE PREPARE planned_email_metadata_stmt;

CREATE TABLE IF NOT EXISTS `AdminApiOperation` (
  `id` CHAR(36) NOT NULL,
  `keyId` CHAR(36) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `action` VARCHAR(64) NOT NULL,
  `bodyHash` CHAR(64) NOT NULL,
  `result` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `AdminApiOperation_keyId_idempotencyKey_key`(`keyId`, `idempotencyKey`),
  INDEX `AdminApiOperation_action_createdAt_idx`(`action`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @admin_api_operation_fk_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `AdminApiOperation` ADD CONSTRAINT `AdminApiOperation_keyId_fkey` FOREIGN KEY (`keyId`) REFERENCES `AdminApiKey`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'AdminApiOperation'
    AND CONSTRAINT_NAME = 'AdminApiOperation_keyId_fkey'
);
PREPARE admin_api_operation_fk_stmt FROM @admin_api_operation_fk_sql;
EXECUTE admin_api_operation_fk_stmt;
DEALLOCATE PREPARE admin_api_operation_fk_stmt;
