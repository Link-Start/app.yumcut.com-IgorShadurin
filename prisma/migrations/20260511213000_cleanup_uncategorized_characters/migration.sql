-- Remove characters that are not assigned to any category.
-- These rows should not appear in admin catalog and should not be assignable as "no category".
DELETE cv
FROM `CharacterVariation` cv
LEFT JOIN `CharacterCategoryCharacter` ccc ON ccc.characterId = cv.characterId
WHERE ccc.characterId IS NULL;

DELETE c
FROM `Character` c
LEFT JOIN `CharacterCategoryCharacter` ccc ON ccc.characterId = c.id
WHERE ccc.characterId IS NULL;
