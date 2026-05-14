-- Truncate existing values before narrowing column sizes.
UPDATE `Character`
SET `description` = LEFT(`description`, 300)
WHERE `description` IS NOT NULL AND CHAR_LENGTH(`description`) > 300;

UPDATE `Character`
SET `bio` = LEFT(`bio`, 300)
WHERE `bio` IS NOT NULL AND CHAR_LENGTH(`bio`) > 300;

UPDATE `CharacterVariation`
SET `description` = LEFT(`description`, 300)
WHERE `description` IS NOT NULL AND CHAR_LENGTH(`description`) > 300;

-- AlterTable
ALTER TABLE `Character`
    MODIFY `description` VARCHAR(300) NULL,
    MODIFY `bio` VARCHAR(300) NULL;

-- AlterTable
ALTER TABLE `CharacterVariation`
    MODIFY `description` VARCHAR(300) NULL;
