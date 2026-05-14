import path from 'path';
import { promises as fs } from 'fs';
import { prisma } from '@/server/db';
import { ADMIN_CHARACTER_IMPORT_VALIDATION_LIMITS } from '@/shared/validators/admin-character-import';

export type AdminCharacterCategoryDTO = {
  id: string;
  slug: string;
  titleEn: string;
  titleRu: string;
  isActive: boolean;
  priority: number;
};

export type AdminCharacterRowDTO = {
  id: string;
  slug: string | null;
  name: string;
  title: string;
  bio: string | null;
  isPublic: boolean;
  priority: number;
  category: { id: string; slug: string; titleEn: string } | null;
  preparedImageUrl: string | null;
  emptyImageUrl: string | null;
  previewVideoUrl: string | null;
  previewVideoHasAudio: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ListAdminCharactersInput = {
  query?: string;
  categoryId?: string | null;
  page?: number;
  pageSize?: number;
};

export type ListAdminCharactersResult = {
  items: AdminCharacterRowDTO[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type CharacterSlugAvailabilityInput = {
  slug: string;
  categoryId: string | null;
  excludeCharacterId?: string | null;
};

export async function getNextAdminCharacterPriority(categoryId: string): Promise<{ highestPriority: number; nextPriority: number }> {
  const normalizedCategoryId = categoryId.trim();
  if (!normalizedCategoryId) {
    throw new Error('Category is required');
  }

  const category = await prisma.characterCategory.findUnique({
    where: { id: normalizedCategoryId },
    select: { id: true },
  });
  if (!category) {
    throw new Error('Category not found');
  }

  const highest = await prisma.characterCategoryCharacter.findFirst({
    where: { categoryId: normalizedCategoryId },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    select: { priority: true },
  });

  const highestPriority = Number.isFinite(highest?.priority) ? Number(highest?.priority) : 0;
  return {
    highestPriority,
    nextPriority: highestPriority + 1,
  };
}

export type AdminCharacterImportPrecheckIssue = {
  field: 'slug' | 'name' | 'title' | 'bio';
  message: string;
};

export type AdminCharacterImportPrecheckRowInput = {
  key: string;
  slug: string;
  name: string;
  title: string;
  bio?: string | null;
};

export type AdminCharacterImportPrecheckResult = {
  items: Array<{
    key: string;
    issues: AdminCharacterImportPrecheckIssue[];
  }>;
};

export type AdminCharacterPriorityCheckInput = {
  categoryId: string;
  slugs: string[];
};

export type AdminCharacterPriorityCheckResult = {
  categoryId: string;
  normalizedSlugs: string[];
  existingSlugs: string[];
  missingSlugs: string[];
  existingCount: number;
  missingCount: number;
};

export type AdminCharacterPriorityApplyInput = {
  categoryId: string;
  slugs: string[];
};

export type AdminCharacterPriorityApplyResult = {
  categoryId: string;
  normalizedSlugs: string[];
  existingSlugs: string[];
  missingSlugs: string[];
  updatedCount: number;
  totalInCategory: number;
  highestPriority: number;
  step: number;
};

export type CharacterPriorityReindexPlanInput = {
  orderedCharacterIds: string[];
  slugByCharacterId: Record<string, string>;
  prioritizedSlugs: string[];
  step?: number;
};

export type CharacterPriorityReindexPlanResult = {
  finalHighToLowCharacterIds: string[];
  existingPrioritizedSlugs: string[];
  missingPrioritizedSlugs: string[];
  priorityByCharacterId: Record<string, number>;
  step: number;
};

function toIso(value: Date): string {
  return value.toISOString();
}

function normalizePrioritySlugList(input: string[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const item of input) {
    const slug = slugify(item || '');
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    normalized.push(slug);
  }
  return normalized;
}

export function buildCharacterPriorityReindexPlan(input: CharacterPriorityReindexPlanInput): CharacterPriorityReindexPlanResult {
  const orderedCharacterIds = input.orderedCharacterIds.slice();
  const step = Number.isFinite(input.step) && Number(input.step) > 0 ? Math.floor(Number(input.step)) : 10;
  const normalizedPrioritizedSlugs = normalizePrioritySlugList(input.prioritizedSlugs);

  const characterIdBySlug = new Map<string, string>();
  for (const characterId of orderedCharacterIds) {
    const slug = slugify(input.slugByCharacterId[characterId] || '');
    if (!slug || characterIdBySlug.has(slug)) continue;
    characterIdBySlug.set(slug, characterId);
  }

  const prioritizedCharacterIds: string[] = [];
  const prioritizedSet = new Set<string>();
  const existingPrioritizedSlugs: string[] = [];
  const missingPrioritizedSlugs: string[] = [];

  for (const slug of normalizedPrioritizedSlugs) {
    const characterId = characterIdBySlug.get(slug);
    if (!characterId) {
      missingPrioritizedSlugs.push(slug);
      continue;
    }
    if (prioritizedSet.has(characterId)) continue;
    prioritizedSet.add(characterId);
    prioritizedCharacterIds.push(characterId);
    existingPrioritizedSlugs.push(slug);
  }

  const remainingCharacterIds = orderedCharacterIds.filter((characterId) => !prioritizedSet.has(characterId));
  const finalHighToLowCharacterIds = [...prioritizedCharacterIds, ...remainingCharacterIds];
  const priorityByCharacterId: Record<string, number> = {};
  const total = finalHighToLowCharacterIds.length;

  for (let i = 0; i < total; i += 1) {
    const characterId = finalHighToLowCharacterIds[i];
    // Highest item gets the highest numeric priority; bottom gets `step`.
    priorityByCharacterId[characterId] = (total - i) * step;
  }

  return {
    finalHighToLowCharacterIds,
    existingPrioritizedSlugs,
    missingPrioritizedSlugs,
    priorityByCharacterId,
    step,
  };
}

function normalizeImageUrl(imagePath: string | null | undefined): string | null {
  if (!imagePath) return null;
  const value = imagePath.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/')) return value;
  if (value.startsWith('public/')) return `/${value.slice('public/'.length)}`;
  return `/${value}`;
}

function normalizeVideoUrl(videoPath: string | null | undefined): string | null {
  if (!videoPath) return null;
  const value = videoPath.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/')) return value;
  if (value.startsWith('public/')) return `/${value.slice('public/'.length)}`;
  return `/${value}`;
}

export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getCharactersPublicRoot(): string {
  const override = process.env.CHARACTER_IMPORT_PUBLIC_ROOT?.trim();
  if (override && override.length > 0) return path.resolve(override);
  return path.resolve('public/characters');
}

function makeDbImagePath(categorySlug: string, characterSlug: string, fileName: string): string {
  return `characters/${categorySlug}/${characterSlug}/original/${fileName}`;
}

function makeDbVideoPath(categorySlug: string, characterSlug: string, fileName: string): string {
  return `characters/${categorySlug}/${characterSlug}/preview/${fileName}`;
}

function toPublicPath(input: string): string {
  return input.startsWith('/') ? input : `/${input}`;
}

function publicUrlToAbsolutePath(input: string): string | null {
  const value = input.trim();
  if (!value || /^https?:\/\//i.test(value)) return null;
  let normalized = value;
  if (normalized.startsWith('public/')) normalized = normalized.slice('public/'.length);
  if (normalized.startsWith('/')) normalized = normalized.slice(1);
  if (!normalized.startsWith('characters/')) return null;
  return path.join(path.resolve('public'), normalized);
}

type CharacterAssetSnapshot = {
  previewVideoUrl: string | null;
  variations: Array<{
    imagePath: string | null;
    emptyImagePath: string | null;
  }>;
};

function collectCharacterAssetPaths(characters: CharacterAssetSnapshot[]): string[] {
  const unique = new Set<string>();
  for (const character of characters) {
    const candidates = [
      character.previewVideoUrl,
      ...character.variations.flatMap((variation) => [variation.imagePath, variation.emptyImagePath]),
    ];
    for (const candidate of candidates) {
      if (!candidate) continue;
      const abs = publicUrlToAbsolutePath(candidate);
      if (abs) unique.add(abs);
    }
  }
  return Array.from(unique);
}

async function removeCharacterAssetFiles(characters: CharacterAssetSnapshot[]): Promise<void> {
  const paths = collectCharacterAssetPaths(characters);
  if (!paths.length) return;
  await Promise.allSettled(paths.map((assetPath) => fs.rm(assetPath, { force: true })));
}

async function writeUploadedFile(targetPath: string, file: File): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(targetPath, buffer);
}

export async function listAdminCharacterCategories(): Promise<AdminCharacterCategoryDTO[]> {
  const items = await prisma.characterCategory.findMany({
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      slug: true,
      titleEn: true,
      titleRu: true,
      isActive: true,
      priority: true,
    },
  });
  return items;
}

export async function createAdminCharacterCategory(input: {
  slug: string;
  title: string;
  isActive?: boolean;
  priority?: number;
}): Promise<AdminCharacterCategoryDTO> {
  const slug = slugify(input.slug);
  const title = input.title.trim();
  const created = await prisma.characterCategory.create({
    data: {
      slug,
      titleEn: title,
      titleRu: title,
      isActive: input.isActive ?? true,
      priority: Number.isFinite(input.priority) ? Math.floor(input.priority as number) : 0,
    },
    select: {
      id: true,
      slug: true,
      titleEn: true,
      titleRu: true,
      isActive: true,
      priority: true,
    },
  });
  return created;
}

export async function updateAdminCharacterCategory(
  id: string,
  input: {
    slug?: string;
    title?: string;
    isActive?: boolean;
    priority?: number;
  },
): Promise<AdminCharacterCategoryDTO> {
  const data: Record<string, unknown> = {};
  if (typeof input.slug === 'string') data.slug = slugify(input.slug);
  if (typeof input.title === 'string') {
    const title = input.title.trim();
    data.titleEn = title;
    data.titleRu = title;
  }
  if (typeof input.isActive === 'boolean') data.isActive = input.isActive;
  if (typeof input.priority === 'number' && Number.isFinite(input.priority)) data.priority = Math.floor(input.priority);

  const updated = await prisma.characterCategory.update({
    where: { id },
    data,
    select: {
      id: true,
      slug: true,
      titleEn: true,
      titleRu: true,
      isActive: true,
      priority: true,
    },
  });
  return updated;
}

function clampPageSize(value: number | undefined): number {
  const base = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 30;
  return Math.min(Math.max(base, 1), 500);
}

function clampPage(value: number | undefined): number {
  const base = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 1;
  return Math.max(base, 1);
}

export async function isAdminCharacterSlugAvailable(input: CharacterSlugAvailabilityInput): Promise<boolean> {
  const slug = slugify(input.slug || '');
  if (!slug) return false;

  if (input.categoryId && input.categoryId.trim().length > 0) {
    const duplicateInCategory = await prisma.characterCategoryCharacter.findFirst({
      where: {
        categoryId: input.categoryId,
        character: {
          slug,
          ...(input.excludeCharacterId
            ? { id: { not: input.excludeCharacterId } }
            : {}),
        },
      },
      select: { characterId: true },
    });
    return !duplicateInCategory;
  }

  const duplicateUncategorized = await prisma.character.findFirst({
    where: {
      slug,
      ...(input.excludeCharacterId
        ? { id: { not: input.excludeCharacterId } }
        : {}),
      categories: {
        none: {},
      },
    },
    select: { id: true },
  });
  return !duplicateUncategorized;
}

async function resolveActiveBioMax(): Promise<number> {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ maxLength: unknown }>>(
      `
        SELECT CHARACTER_MAXIMUM_LENGTH AS maxLength
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND (
            (TABLE_NAME = 'Character' AND COLUMN_NAME IN ('description', 'bio'))
            OR (TABLE_NAME = 'CharacterVariation' AND COLUMN_NAME = 'description')
          )
      `,
    );
    const values = (rows || [])
      .map((row) => Number(row?.maxLength))
      .filter((n) => Number.isFinite(n) && n > 0) as number[];
    if (!values.length) return ADMIN_CHARACTER_IMPORT_VALIDATION_LIMITS.bioMax;
    return Math.min(...values);
  } catch {
    return ADMIN_CHARACTER_IMPORT_VALIDATION_LIMITS.bioMax;
  }
}

export async function precheckAdminCharacterImportRows(input: {
  categoryId: string;
  rows: AdminCharacterImportPrecheckRowInput[];
}): Promise<AdminCharacterImportPrecheckResult> {
  const categoryId = input.categoryId.trim();
  const rows = input.rows.slice(0, 100);
  const bioMax = await resolveActiveBioMax();
  const issuesByKey: Record<string, AdminCharacterImportPrecheckIssue[]> = {};

  const addIssue = (key: string, issue: AdminCharacterImportPrecheckIssue) => {
    const list = issuesByKey[key] || [];
    if (!list.some((entry) => entry.field === issue.field && entry.message === issue.message)) {
      list.push(issue);
    }
    issuesByKey[key] = list;
  };

  const normalizedRows = rows.map((row) => {
    const slug = slugify(row.slug || '');
    const name = (row.name || '').trim();
    const title = (row.title || '').trim();
    const bio = (row.bio || '').trim();

    if (!slug) addIssue(row.key, { field: 'slug', message: 'slug is required' });
    if (slug && slug.length > ADMIN_CHARACTER_IMPORT_VALIDATION_LIMITS.slugMax) {
      addIssue(row.key, { field: 'slug', message: `slug must be at most ${ADMIN_CHARACTER_IMPORT_VALIDATION_LIMITS.slugMax} characters` });
    }
    if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      addIssue(row.key, { field: 'slug', message: 'slug format is invalid' });
    }
    if (!name) addIssue(row.key, { field: 'name', message: 'name is required' });
    if (name.length > ADMIN_CHARACTER_IMPORT_VALIDATION_LIMITS.nameMax) {
      addIssue(row.key, { field: 'name', message: `name must be at most ${ADMIN_CHARACTER_IMPORT_VALIDATION_LIMITS.nameMax} characters` });
    }
    if (!title) addIssue(row.key, { field: 'title', message: 'title is required' });
    if (title.length > ADMIN_CHARACTER_IMPORT_VALIDATION_LIMITS.titleMax) {
      addIssue(row.key, { field: 'title', message: `title must be at most ${ADMIN_CHARACTER_IMPORT_VALIDATION_LIMITS.titleMax} characters` });
    }
    if (bio.length > bioMax) {
      addIssue(row.key, { field: 'bio', message: `short description must be at most ${bioMax} characters (current: ${bio.length})` });
    }

    return { key: row.key, slug };
  });

  const slugCounts = new Map<string, number>();
  for (const row of normalizedRows) {
    if (!row.slug) continue;
    slugCounts.set(row.slug, (slugCounts.get(row.slug) || 0) + 1);
  }

  for (const row of normalizedRows) {
    if (!row.slug) continue;
    if ((slugCounts.get(row.slug) || 0) > 1) {
      addIssue(row.key, { field: 'slug', message: 'slug is duplicated in the selected import rows' });
    }
  }

  if (!categoryId) {
    for (const row of normalizedRows) {
      addIssue(row.key, { field: 'slug', message: 'categoryId is required for DB precheck' });
    }
    return {
      items: rows.map((row) => ({ key: row.key, issues: issuesByKey[row.key] || [] })),
    };
  }

  const category = await prisma.characterCategory.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });
  if (!category) {
    for (const row of normalizedRows) {
      addIssue(row.key, { field: 'slug', message: 'Selected category was not found' });
    }
    return {
      items: rows.map((row) => ({ key: row.key, issues: issuesByKey[row.key] || [] })),
    };
  }

  const uniqueSlugs = Array.from(new Set(normalizedRows.map((row) => row.slug).filter((slug) => slug.length > 0)));
  if (uniqueSlugs.length > 0) {
    const [existingCharacters, existingInCategory] = await prisma.$transaction([
      prisma.character.findMany({
        where: { slug: { in: uniqueSlugs } },
        select: { slug: true },
      }),
      prisma.characterCategoryCharacter.findMany({
        where: {
          categoryId: category.id,
          character: {
            slug: { in: uniqueSlugs },
          },
        },
        select: {
          character: {
            select: { slug: true },
          },
        },
      }),
    ]);

    const existingSlugSet = new Set(existingCharacters.map((entry) => entry.slug).filter((slug): slug is string => !!slug));
    const existingInCategorySlugSet = new Set(existingInCategory.map((entry) => entry.character.slug).filter((slug): slug is string => !!slug));

    for (const row of normalizedRows) {
      if (!row.slug) continue;
      if (existingInCategorySlugSet.has(row.slug)) {
        addIssue(row.key, { field: 'slug', message: 'slug already exists in selected category' });
      } else if (existingSlugSet.has(row.slug)) {
        addIssue(row.key, { field: 'slug', message: 'slug already exists' });
      }
    }
  }

  return {
    items: rows.map((row) => ({ key: row.key, issues: issuesByKey[row.key] || [] })),
  };
}

async function loadCategoryCharactersForPriority(categoryId: string) {
  return prisma.characterCategoryCharacter.findMany({
    where: { categoryId },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }, { characterId: 'asc' }],
    select: {
      characterId: true,
      character: {
        select: {
          id: true,
          slug: true,
        },
      },
    },
  });
}

export async function checkAdminCharacterPriorities(input: AdminCharacterPriorityCheckInput): Promise<AdminCharacterPriorityCheckResult> {
  const categoryId = input.categoryId.trim();
  if (!categoryId) {
    throw new Error('Category is required');
  }

  const category = await prisma.characterCategory.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });
  if (!category) {
    throw new Error('Category not found');
  }

  const normalizedSlugs = normalizePrioritySlugList(input.slugs || []);
  const links = await loadCategoryCharactersForPriority(categoryId);
  const slugSet = new Set(
    links
      .map((entry) => slugify(entry.character.slug || ''))
      .filter((slug) => slug.length > 0),
  );

  const existingSlugs: string[] = [];
  const missingSlugs: string[] = [];
  for (const slug of normalizedSlugs) {
    if (slugSet.has(slug)) {
      existingSlugs.push(slug);
    } else {
      missingSlugs.push(slug);
    }
  }

  return {
    categoryId: category.id,
    normalizedSlugs,
    existingSlugs,
    missingSlugs,
    existingCount: existingSlugs.length,
    missingCount: missingSlugs.length,
  };
}

export async function applyAdminCharacterPriorities(input: AdminCharacterPriorityApplyInput): Promise<AdminCharacterPriorityApplyResult> {
  const categoryId = input.categoryId.trim();
  if (!categoryId) {
    throw new Error('Category is required');
  }

  return prisma.$transaction(async (tx) => {
    const category = await tx.characterCategory.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!category) {
      throw new Error('Category not found');
    }

    const links = await tx.characterCategoryCharacter.findMany({
      where: { categoryId: category.id },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }, { characterId: 'asc' }],
      select: {
        characterId: true,
        character: {
          select: {
            slug: true,
          },
        },
      },
    });

    const orderedCharacterIds = links.map((entry) => entry.characterId);
    const slugByCharacterId: Record<string, string> = {};
    for (const entry of links) {
      slugByCharacterId[entry.characterId] = entry.character.slug || '';
    }

    const normalizedSlugs = normalizePrioritySlugList(input.slugs || []);
    const plan = buildCharacterPriorityReindexPlan({
      orderedCharacterIds,
      slugByCharacterId,
      prioritizedSlugs: normalizedSlugs,
      step: 10,
    });

    for (const characterId of plan.finalHighToLowCharacterIds) {
      const nextPriority = plan.priorityByCharacterId[characterId];
      if (!Number.isFinite(nextPriority)) continue;

      await tx.characterCategoryCharacter.update({
        where: {
          categoryId_characterId: {
            categoryId: category.id,
            characterId,
          },
        },
        data: { priority: nextPriority },
      });
      await tx.character.update({
        where: { id: characterId },
        data: { priority: nextPriority },
      });
    }

    const highestPriority = links.length * plan.step;
    return {
      categoryId: category.id,
      normalizedSlugs,
      existingSlugs: plan.existingPrioritizedSlugs,
      missingSlugs: plan.missingPrioritizedSlugs,
      updatedCount: links.length,
      totalInCategory: links.length,
      highestPriority,
      step: plan.step,
    };
  });
}

export async function listAdminCharacters(input: ListAdminCharactersInput = {}): Promise<ListAdminCharactersResult> {
  const normalized = (input.query || '').trim();
  const pageSize = clampPageSize(input.pageSize);
  const page = clampPage(input.page);
  const skip = (page - 1) * pageSize;
  const hasCategoryFilter = !!(input.categoryId && input.categoryId.trim().length > 0);

  const mapCharacterRow = (item: any): AdminCharacterRowDTO => {
    const primaryVariation = item.variations[0] ?? null;
    const primaryCategory = item.categories[0]?.category ?? null;
    return {
      id: item.id,
      slug: item.slug,
      name: item.name?.trim() || item.title,
      title: item.title,
      bio: item.bio?.trim() || item.description?.trim() || null,
      isPublic: item.isCatalogPublic,
      priority: item.priority,
      category: primaryCategory
        ? {
          id: primaryCategory.id,
          slug: primaryCategory.slug,
          titleEn: primaryCategory.titleEn,
        }
        : null,
      preparedImageUrl: normalizeImageUrl(primaryVariation?.imagePath),
      emptyImageUrl: normalizeImageUrl(primaryVariation?.emptyImagePath),
      previewVideoUrl: normalizeVideoUrl(item.previewVideoUrl),
      previewVideoHasAudio: item.previewVideoHasAudio !== false,
      createdAt: toIso(item.createdAt),
      updatedAt: toIso(item.updatedAt),
    };
  };

  if (hasCategoryFilter) {
    const whereLink: any = {
      categoryId: input.categoryId!,
      character: {
        slug: { not: null },
        ...(normalized
          ? {
            OR: [
              { slug: { contains: normalized } },
              { name: { contains: normalized } },
              { title: { contains: normalized } },
            ],
          }
          : {}),
      },
    };

    const [links, total] = await prisma.$transaction([
      prisma.characterCategoryCharacter.findMany({
        where: whereLink,
        skip,
        take: pageSize,
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        include: {
          character: {
            include: {
              variations: {
                orderBy: [{ priority: 'desc' }, { id: 'asc' }],
                select: { imagePath: true, emptyImagePath: true },
              },
              categories: {
                orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
                include: {
                  category: {
                    select: { id: true, slug: true, titleEn: true },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.characterCategoryCharacter.count({ where: whereLink }),
    ]);

    return {
      items: links.map((entry) => mapCharacterRow(entry.character)),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  const where: any = {
    slug: { not: null },
    categories: {
      some: {},
    },
    ...(normalized
      ? {
        OR: [
          { slug: { contains: normalized } },
          { name: { contains: normalized } },
          { title: { contains: normalized } },
        ],
      }
      : {}),
  };
  if (input.categoryId && input.categoryId.trim().length > 0) {
    where.categories = {
      some: { categoryId: input.categoryId },
    };
  }

  const [items, total] = await prisma.$transaction([
    prisma.character.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      include: {
        variations: {
          orderBy: [{ priority: 'desc' }, { id: 'asc' }],
          select: { imagePath: true, emptyImagePath: true },
        },
        categories: {
          orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
          include: {
            category: {
              select: { id: true, slug: true, titleEn: true },
            },
          },
        },
      },
    }),
    prisma.character.count({ where }),
  ]);

  const mapped = items.map((item) => mapCharacterRow(item));

  return {
    items: mapped,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function uploadAdminCharacterPreviewVideo(input: {
  id: string;
  videoFile: File;
  extension: string;
  hasAudio?: boolean;
}): Promise<{ previewVideoUrl: string }> {
  const character = await prisma.character.findUnique({
    where: { id: input.id },
    select: {
      id: true,
      slug: true,
      previewVideoUrl: true,
      categories: {
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        take: 1,
        include: {
          category: { select: { slug: true } },
        },
      },
    },
  });
  if (!character) throw new Error('Character not found');

  const slug = slugify(character.slug || '');
  if (!slug) throw new Error('Character slug is empty');
  const categorySlug = slugify(character.categories[0]?.category?.slug || '') || 'uncategorized';
  const ext = input.extension.trim().toLowerCase().replace(/^\./, '');
  const fileName = `preview.${ext}`;

  const root = getCharactersPublicRoot();
  const targetPath = path.join(root, categorySlug, slug, 'preview', fileName);
  await writeUploadedFile(targetPath, input.videoFile);

  const dbPath = makeDbVideoPath(categorySlug, slug, fileName);
  const previousVideoUrl = normalizeVideoUrl(character.previewVideoUrl);
  await prisma.character.update({
    where: { id: character.id },
    data: {
      previewVideoUrl: dbPath,
      previewVideoHasAudio: input.hasAudio !== false,
    },
  });

  if (previousVideoUrl) {
    const previousAbsPath = publicUrlToAbsolutePath(previousVideoUrl);
    if (previousAbsPath && previousAbsPath !== targetPath) {
      await fs.rm(previousAbsPath, { force: true }).catch(() => {});
    }
  }

  return { previewVideoUrl: toPublicPath(dbPath) };
}

export async function deleteAdminCharacterPreviewVideo(id: string): Promise<void> {
  const character = await prisma.character.findUnique({
    where: { id },
    select: { id: true, previewVideoUrl: true },
  });
  if (!character) return;

  const previousVideoUrl = normalizeVideoUrl(character.previewVideoUrl);
  if (previousVideoUrl) {
    const previousAbsPath = publicUrlToAbsolutePath(previousVideoUrl);
    if (previousAbsPath) {
      await fs.rm(previousAbsPath, { force: true }).catch(() => {});
    }
  }

  await prisma.character.update({
    where: { id },
    data: { previewVideoUrl: null },
  });
}

export async function updateAdminCharacter(
  id: string,
  input: {
    slug?: string;
    name?: string;
    title?: string;
    bio?: string | null;
    isPublic?: boolean;
    priority?: number;
    categoryId?: string;
    previewVideoHasAudio?: boolean;
  },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.character.findUnique({
      where: { id },
      include: {
        categories: true,
        variations: { orderBy: [{ priority: 'desc' }, { id: 'asc' }], select: { id: true } },
      },
    });
    if (!existing) return;

    const nextSlug = typeof input.slug === 'string' && input.slug.trim().length > 0
      ? slugify(input.slug)
      : slugify(existing.slug || '');

    const data: Record<string, unknown> = {};
    if (typeof input.slug === 'string' && input.slug.trim().length > 0) data.slug = nextSlug;
    if (typeof input.name === 'string') data.name = input.name.trim();
    if (typeof input.title === 'string') data.title = input.title.trim();
    if (input.bio !== undefined) {
      const bio = typeof input.bio === 'string' ? input.bio.trim() : '';
      data.bio = bio || null;
      data.description = bio || null;
    }
    if (typeof input.isPublic === 'boolean') data.isCatalogPublic = input.isPublic;
    if (typeof input.priority === 'number' && Number.isFinite(input.priority)) data.priority = Math.floor(input.priority);
    if (typeof input.previewVideoHasAudio === 'boolean') data.previewVideoHasAudio = input.previewVideoHasAudio;

    await tx.character.update({ where: { id }, data });

    if (existing.variations[0] && input.bio !== undefined) {
      const bio = typeof input.bio === 'string' ? input.bio.trim() : '';
      await tx.characterVariation.update({
        where: { id: existing.variations[0].id },
        data: { description: bio || null, title: (typeof input.name === 'string' ? input.name.trim() : undefined) },
      });
    }

    if (input.categoryId !== undefined) {
      const requestedCategoryId = input.categoryId.trim();
      if (!requestedCategoryId) {
        throw new Error('Category is required');
      }
      const categoryExists = await tx.characterCategory.findUnique({
        where: { id: requestedCategoryId },
        select: { id: true },
      });
      if (!categoryExists) {
        throw new Error('Category not found');
      }
      await tx.characterCategoryCharacter.deleteMany({ where: { characterId: id } });
      await tx.characterCategoryCharacter.create({
        data: {
          characterId: id,
          categoryId: requestedCategoryId,
          priority: typeof input.priority === 'number' && Number.isFinite(input.priority)
            ? Math.floor(input.priority)
            : existing.priority,
        },
      });
    }
  });
}

export async function softDeleteAdminCharacter(id: string, deleteFiles = false): Promise<void> {
  const character = deleteFiles
    ? await prisma.character.findUnique({
      where: { id },
      select: {
        previewVideoUrl: true,
        variations: {
          select: { imagePath: true, emptyImagePath: true },
        },
      },
    })
    : null;
  await prisma.$transaction(async (tx) => {
    await tx.characterVariation.deleteMany({
      where: { characterId: id },
    });
    await tx.character.delete({
      where: { id },
    });
  });
  if (deleteFiles && character) {
    await removeCharacterAssetFiles([character]);
  }
}

export async function softDeleteAdminCharacters(ids: string[], deleteFiles = false): Promise<number> {
  const uniqueIds = Array.from(new Set(
    ids
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
  ));
  if (!uniqueIds.length) return 0;

  const characters = deleteFiles
    ? await prisma.character.findMany({
      where: { id: { in: uniqueIds } },
      select: {
        previewVideoUrl: true,
        variations: {
          select: { imagePath: true, emptyImagePath: true },
        },
      },
    })
    : [];

  const deleted = await prisma.$transaction(async (tx) => {
    await tx.characterVariation.deleteMany({
      where: { characterId: { in: uniqueIds } },
    });
    const result = await tx.character.deleteMany({
      where: { id: { in: uniqueIds } },
    });
    return result.count;
  });

  if (deleteFiles && characters.length) {
    await removeCharacterAssetFiles(characters);
  }

  return deleted;
}

export async function bulkSetAdminCharactersVisibility(ids: string[], isPublic: boolean): Promise<number> {
  const uniqueIds = Array.from(new Set(
    ids
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
  ));
  if (!uniqueIds.length) return 0;

  const updated = await prisma.character.updateMany({
    where: { id: { in: uniqueIds } },
    data: { isCatalogPublic: isPublic },
  });
  return updated.count;
}

export async function importAdminCharacter(input: {
  categoryId: string;
  slug: string;
  name: string;
  title: string;
  bio?: string | null;
  isPublic?: boolean;
  preparedFile: File;
  emptyFile: File;
}): Promise<{ status: 'saved' | 'skipped'; reason?: 'slug_exists' | 'slug_exists_in_category'; characterId?: string }> {
  const category = await prisma.characterCategory.findUnique({
    where: { id: input.categoryId },
    select: { id: true, slug: true },
  });
  if (!category) {
    throw new Error('Category not found');
  }

  const slug = slugify(input.slug);
  if (!slug) {
    throw new Error('Invalid character slug');
  }

  const slugAvailableInCategory = await isAdminCharacterSlugAvailable({
    slug,
    categoryId: category.id,
  });
  if (!slugAvailableInCategory) {
    return { status: 'skipped', reason: 'slug_exists_in_category' };
  }

  const existing = await prisma.character.findUnique({ where: { slug }, select: { id: true } });
  if (existing) {
    return { status: 'skipped', reason: 'slug_exists' };
  }

  const root = getCharactersPublicRoot();
  const originalDir = path.join(root, category.slug, slug, 'original');
  const preparedAbs = path.join(originalDir, 'prepared.webp');
  const emptyAbs = path.join(originalDir, 'empty.webp');
  await writeUploadedFile(preparedAbs, input.preparedFile);
  await writeUploadedFile(emptyAbs, input.emptyFile);

  const dbPreparedPath = makeDbImagePath(category.slug, slug, 'prepared.webp');
  const dbEmptyPath = makeDbImagePath(category.slug, slug, 'empty.webp');

  const created = await prisma.$transaction(async (tx) => {
    const character = await tx.character.create({
      data: {
        slug,
        title: input.title.trim() || input.name.trim(),
        name: input.name.trim() || input.title.trim(),
        description: input.bio?.trim() || null,
        bio: input.bio?.trim() || null,
        isCatalogPublic: input.isPublic === true,
      },
      select: { id: true, priority: true },
    });

    await tx.characterVariation.create({
      data: {
        characterId: character.id,
        title: input.name.trim() || input.title.trim(),
        description: input.bio?.trim() || null,
        imagePath: dbPreparedPath,
        emptyImagePath: dbEmptyPath,
        priority: character.priority,
      },
    });

    await tx.characterCategoryCharacter.create({
      data: {
        categoryId: category.id,
        characterId: character.id,
        priority: character.priority,
      },
    });

    return character;
  });

  return { status: 'saved', characterId: created.id };
}
