import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const write = process.argv.includes('--write');

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function cleanString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\0/g, '').trim();
  if (!normalized) return null;
  return Array.from(normalized).slice(0, maxLength).join('');
}

function jsonArray(value: unknown): Prisma.InputJsonValue[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const output = value
    .slice(0, 20)
    .map((item) => cleanString(item, 32))
    .filter((item): item is string => Boolean(item));
  return output.length > 0 ? output : undefined;
}

function jsonRecord(value: unknown): Prisma.InputJsonObject | undefined {
  const record = asRecord(value);
  const output: Record<string, Prisma.InputJsonValue> = {};
  for (const [key, rawValue] of Object.entries(record).slice(0, 30)) {
    const normalizedKey = cleanString(key, 80);
    if (!normalizedKey) continue;
    if (typeof rawValue === 'string') {
      const text = cleanString(rawValue, 300);
      if (text) output[normalizedKey] = text;
    } else if (typeof rawValue === 'boolean' || typeof rawValue === 'number') {
      if (typeof rawValue !== 'number' || Number.isFinite(rawValue)) {
        output[normalizedKey] = rawValue;
      }
    }
  }
  return Object.keys(output).length > 0 ? output as Prisma.InputJsonObject : undefined;
}

function inferPromptMode(project: { prompt: string | null; rawScript: string | null }) {
  if (project.rawScript && !project.prompt) return 'script';
  return 'idea';
}

function inferProjectExperience(payload: JsonRecord, characterSlug: string | null, hasSelection: boolean) {
  const explicit = cleanString(payload.projectExperience, 32);
  if (explicit === 'character' || explicit === 'story') return explicit;
  return characterSlug || hasSelection ? 'character' : 'story';
}

function buildAttributionData(
  userId: string,
  first: {
    id: string;
    promptText: string | null;
    promptMode: string | null;
    projectExperience: string | null;
    mainPageMode: string | null;
    mainPageCategoryId: string | null;
    characterSlug: string | null;
    templateId: string | null;
    utmSource: string | null;
    sourceToolSlug: string | null;
    intent: string | null;
    referrerOrigin: string | null;
    referrerPath: string | null;
    landingPath: string | null;
  },
  last: typeof first,
): Prisma.UserAttributionUncheckedCreateInput {
  return {
    userId,
    firstUtmSource: first.utmSource,
    lastUtmSource: last.utmSource,
    firstReferrerOrigin: first.referrerOrigin,
    firstReferrerPath: first.referrerPath,
    lastReferrerOrigin: last.referrerOrigin,
    lastReferrerPath: last.referrerPath,
    firstLandingPath: first.landingPath,
    lastLandingPath: last.landingPath,
    firstSourceToolSlug: first.sourceToolSlug,
    lastSourceToolSlug: last.sourceToolSlug,
    firstIntent: first.intent,
    lastIntent: last.intent,
    firstProjectPrompt: first.promptText,
    firstProjectPromptMode: first.promptMode,
    firstProjectExperience: first.projectExperience,
    firstMainPageMode: first.mainPageMode,
    firstMainPageCategoryId: first.mainPageCategoryId,
    firstCharacterSlug: first.characterSlug,
    firstTemplateId: first.templateId,
    firstProjectAttemptId: first.id,
  };
}

async function refreshUserAttribution(userId: string) {
  const [first, last] = await Promise.all([
    prisma.projectCreationAttempt.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.projectCreationAttempt.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  if (!first || !last) return;
  const data = buildAttributionData(userId, first, last);
  await prisma.userAttribution.upsert({
    where: { userId },
    create: data,
    update: data,
  });
}

async function main() {
  const projects = await prisma.project.findMany({
    where: { deleted: false },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      userId: true,
      prompt: true,
      rawScript: true,
      templateId: true,
      languages: true,
      createdAt: true,
      updatedAt: true,
      selection: { select: { id: true } },
      jobs: {
        where: { type: 'script' },
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: { payload: true },
      },
    },
  });

  let created = 0;
  let skipped = 0;
  const touchedUsers = new Set<string>();

  for (const project of projects) {
    const clientAttemptId = `backfill:${project.id}`;
    const exists = await prisma.projectCreationAttempt.findUnique({
      where: {
        userId_clientAttemptId: {
          userId: project.userId,
          clientAttemptId,
        },
      },
      select: { id: true },
    });
    if (exists) {
      skipped += 1;
      continue;
    }

    const payload = asRecord(project.jobs[0]?.payload);
    const characterSlug = cleanString(payload.characterSlug, 191);
    const projectExperience = inferProjectExperience(payload, characterSlug, Boolean(project.selection));
    const promptText = cleanString(project.prompt || project.rawScript, 15_000);
    const languageCodes = jsonArray(payload.languages) ?? jsonArray(project.languages);
    const languageVoices = jsonRecord(payload.languageVoices);
    const mainPageMode = projectExperience === 'character' ? 'brainrot' : 'stories';

    if (write) {
      await prisma.projectCreationAttempt.create({
        data: {
          userId: project.userId,
          projectId: project.id,
          clientAttemptId,
          result: 'project_created',
          promptText,
          promptMode: inferPromptMode(project),
          projectExperience,
          durationSeconds: typeof payload.durationSeconds === 'number' && Number.isFinite(payload.durationSeconds)
            ? Math.max(0, Math.round(payload.durationSeconds))
            : null,
          mainPageMode,
          characterSlug,
          templateId: project.templateId,
          languageCodes,
          languageVoices,
          settingsSnapshot: jsonRecord(payload),
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        },
      });
      touchedUsers.add(project.userId);
    }
    created += 1;
  }

  if (write) {
    for (const userId of touchedUsers) {
      await refreshUserAttribution(userId);
    }
  }

  console.log(JSON.stringify({
    mode: write ? 'write' : 'dry-run',
    projects: projects.length,
    attemptsToCreate: created,
    skipped,
    usersToRefresh: touchedUsers.size,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
