import { prisma } from '@/server/db';

export type AdminPaywallAttemptDTO = {
  id: string;
  userId: string;
  projectId: string | null;
  clientAttemptId: string;
  promptText: string | null;
  promptMode: string | null;
  projectExperience: string | null;
  durationSeconds: number | null;
  tokenCost: number | null;
  tokenBalance: number | null;
  mainPageMode: string | null;
  mainPageCategoryId: string | null;
  characterSlug: string | null;
  templateId: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  intent: string | null;
  sourceToolSlug: string | null;
  referrerOrigin: string | null;
  referrerPath: string | null;
  landingPath: string | null;
  query: unknown;
  languageCodes: unknown;
  settingsSnapshot: unknown;
  rawContext: unknown;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string | null;
    name: string | null;
    isAdmin: boolean;
    createdAt: string;
  } | null;
};

export type AdminPaywallAttemptsResult = {
  items: AdminPaywallAttemptDTO[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AdminPaywallAttemptListInput = {
  page?: number;
  pageSize?: number;
  from?: Date | null;
  to?: Date | null;
  userId?: string | null;
  q?: string | null;
};

function clampPage(value: number | undefined) {
  return Math.max(1, Number.isFinite(value) ? Math.floor(value ?? 1) : 1);
}

function clampPageSize(value: number | undefined) {
  const normalized = Number.isFinite(value) ? Math.floor(value ?? 50) : 50;
  return [50, 100, 200].includes(normalized) ? normalized : 50;
}

function dateRangeWhere(input: AdminPaywallAttemptListInput) {
  const createdAt: { gte?: Date; lte?: Date } = {};
  if (input.from) createdAt.gte = input.from;
  if (input.to) createdAt.lte = input.to;
  return Object.keys(createdAt).length > 0 ? createdAt : undefined;
}

function buildWhere(input: AdminPaywallAttemptListInput) {
  const q = input.q?.trim() || '';
  return {
    result: 'paywall_shown',
    ...(dateRangeWhere(input) ? { createdAt: dateRangeWhere(input) } : {}),
    ...(input.userId?.trim() ? { userId: input.userId.trim() } : {}),
    ...(q
      ? {
          OR: [
            { promptText: { contains: q } },
            { userId: { contains: q } },
            { characterSlug: { contains: q } },
            { user: { email: { contains: q } } },
            { user: { name: { contains: q } } },
          ],
        }
      : {}),
  };
}

function mapAttempt(attempt: any): AdminPaywallAttemptDTO {
  return {
    id: attempt.id,
    userId: attempt.userId,
    projectId: attempt.projectId ?? null,
    clientAttemptId: attempt.clientAttemptId,
    promptText: attempt.promptText ?? null,
    promptMode: attempt.promptMode ?? null,
    projectExperience: attempt.projectExperience ?? null,
    durationSeconds: attempt.durationSeconds ?? null,
    tokenCost: attempt.tokenCost ?? null,
    tokenBalance: attempt.tokenBalance ?? null,
    mainPageMode: attempt.mainPageMode ?? null,
    mainPageCategoryId: attempt.mainPageCategoryId ?? null,
    characterSlug: attempt.characterSlug ?? null,
    templateId: attempt.templateId ?? null,
    utmSource: attempt.utmSource ?? null,
    utmMedium: attempt.utmMedium ?? null,
    utmCampaign: attempt.utmCampaign ?? null,
    intent: attempt.intent ?? null,
    sourceToolSlug: attempt.sourceToolSlug ?? null,
    referrerOrigin: attempt.referrerOrigin ?? null,
    referrerPath: attempt.referrerPath ?? null,
    landingPath: attempt.landingPath ?? null,
    query: attempt.query ?? null,
    languageCodes: attempt.languageCodes ?? null,
    settingsSnapshot: attempt.settingsSnapshot ?? null,
    rawContext: attempt.rawContext ?? null,
    createdAt: attempt.createdAt.toISOString(),
    updatedAt: attempt.updatedAt.toISOString(),
    user: attempt.user
      ? {
          id: attempt.user.id,
          email: attempt.user.email ?? null,
          name: attempt.user.name ?? null,
          isAdmin: !!attempt.user.isAdmin,
          createdAt: attempt.user.createdAt.toISOString(),
        }
      : null,
  };
}

const attemptInclude = {
  user: {
    select: {
      id: true,
      email: true,
      name: true,
      isAdmin: true,
      createdAt: true,
    },
  },
};

export async function listAdminPaywallAttempts(input: AdminPaywallAttemptListInput): Promise<AdminPaywallAttemptsResult> {
  const page = clampPage(input.page);
  const pageSize = clampPageSize(input.pageSize);
  const where = buildWhere(input);
  const [total, items] = await Promise.all([
    prisma.projectCreationAttempt.count({ where }),
    prisma.projectCreationAttempt.findMany({
      where,
      include: attemptInclude,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return {
    items: items.map(mapAttempt),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function exportAdminPaywallAttempts(input: AdminPaywallAttemptListInput) {
  const where = buildWhere(input);
  const items = await prisma.projectCreationAttempt.findMany({
    where,
    include: attemptInclude,
    orderBy: { createdAt: 'asc' },
    take: 50_000,
  });
  return items.map(mapAttempt);
}
