import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { LIMITS } from '@/server/limits';

export const PROJECT_CREATION_ATTEMPT_RESULTS = [
  'draft_created',
  'paywall_shown',
  'confirm_shown',
  'project_created',
] as const;

export const PROJECT_CREATION_ATTEMPT_PROMPT_MODES = ['idea', 'script'] as const;
export const PROJECT_CREATION_ATTEMPT_EXPERIENCES = ['story', 'character'] as const;

export type ProjectCreationAttemptResult = typeof PROJECT_CREATION_ATTEMPT_RESULTS[number];
export type ProjectCreationAttemptPromptMode = typeof PROJECT_CREATION_ATTEMPT_PROMPT_MODES[number];
export type ProjectCreationAttemptExperience = typeof PROJECT_CREATION_ATTEMPT_EXPERIENCES[number];

type JsonObject = Record<string, Prisma.InputJsonValue>;

export type NormalizedProjectCreationAttemptPayload = {
  clientAttemptId: string;
  result: ProjectCreationAttemptResult;
  promptText: string | null;
  promptMode: ProjectCreationAttemptPromptMode | null;
  projectExperience: ProjectCreationAttemptExperience | null;
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
  utmContent: string | null;
  utmTerm: string | null;
  intent: string | null;
  sourceToolSlug: string | null;
  referrerOrigin: string | null;
  referrerPath: string | null;
  landingPath: string | null;
  query: JsonObject | null;
  languageCodes: Prisma.InputJsonValue[] | null;
  languageVoices: JsonObject | null;
  settingsSnapshot: Prisma.InputJsonValue | null;
  rawContext: Prisma.InputJsonValue | null;
};

const RESULT_SET = new Set<string>(PROJECT_CREATION_ATTEMPT_RESULTS);
const PROMPT_MODE_SET = new Set<string>(PROJECT_CREATION_ATTEMPT_PROMPT_MODES);
const EXPERIENCE_SET = new Set<string>(PROJECT_CREATION_ATTEMPT_EXPERIENCES);
const QUERY_KEYS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'intent',
  'yc_t',
  'yc_l',
  'yc_v',
  'yc_d',
  'openMode',
  'openCategory',
  'page',
  'lang',
]);

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
}

function cleanBoundedText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\0/g, '').trim();
  if (!normalized) return null;
  return Array.from(normalized).slice(0, maxLength).join('');
}

function normalizeEnum<T extends string>(value: unknown, allowed: Set<string>, fallback: T | null = null): T | null {
  const normalized = cleanBoundedText(value, 64);
  if (!normalized) return fallback;
  return allowed.has(normalized) ? normalized as T : fallback;
}

function normalizeNonNegativeInt(value: unknown, max = 1_000_000): number | null {
  const numberValue = typeof value === 'number'
    ? value
    : (typeof value === 'string' && value.trim() ? Number(value) : Number.NaN);
  if (!Number.isFinite(numberValue)) return null;
  return Math.max(0, Math.min(max, Math.round(numberValue)));
}

function normalizeUuid(value: unknown): string | null {
  const normalized = cleanBoundedText(value, 36);
  if (!normalized) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)
    ? normalized
    : null;
}

function normalizeLandingPath(value: unknown): string | null {
  const normalized = cleanBoundedText(value, 512);
  if (!normalized) return null;
  if (normalized.startsWith('/')) {
    return normalized.split('?')[0]?.split('#')[0]?.slice(0, 512) || null;
  }
  try {
    const url = new URL(normalized);
    return url.pathname.slice(0, 512) || '/';
  } catch {
    return null;
  }
}

function normalizeReferrer(value: unknown): { origin: string | null; path: string | null } {
  const normalized = cleanBoundedText(value, 2048);
  if (!normalized) return { origin: null, path: null };
  try {
    const url = new URL(normalized);
    if (!['http:', 'https:'].includes(url.protocol)) return { origin: null, path: null };
    return {
      origin: cleanBoundedText(url.origin, 255),
      path: cleanBoundedText(url.pathname || '/', 512),
    };
  } catch {
    return { origin: null, path: null };
  }
}

function sanitizeJsonValue(value: unknown, depth = 0): Prisma.InputJsonValue | null {
  if (depth > 4) return null;
  if (value == null) return null;
  if (typeof value === 'string') return cleanBoundedText(value, 1000);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) {
    return value
      .slice(0, 50)
      .map((item) => sanitizeJsonValue(item, depth + 1))
      .filter((item): item is Prisma.InputJsonValue => item !== null);
  }
  if (typeof value === 'object') {
    const output: JsonObject = {};
    for (const [key, rawValue] of Object.entries(value as Record<string, unknown>).slice(0, 50)) {
      const normalizedKey = cleanBoundedText(key, 80);
      if (!normalizedKey) continue;
      const normalizedValue = sanitizeJsonValue(rawValue, depth + 1);
      if (normalizedValue === null) continue;
      output[normalizedKey] = normalizedValue;
    }
    return Object.keys(output).length > 0 ? output : null;
  }
  return null;
}

function normalizeQuery(value: unknown): JsonObject | null {
  const input = asRecord(value);
  const output: JsonObject = {};
  for (const [key, rawValue] of Object.entries(input)) {
    if (!QUERY_KEYS.has(key)) continue;
    const normalized = Array.isArray(rawValue)
      ? rawValue.slice(0, 5).map((item) => cleanBoundedText(item, 300)).filter(Boolean)
      : cleanBoundedText(rawValue, 300);
    if (normalized == null || (Array.isArray(normalized) && normalized.length === 0)) continue;
    output[key] = normalized as Prisma.InputJsonValue;
  }
  return Object.keys(output).length > 0 ? output : null;
}

function firstQueryString(query: JsonObject | null, key: string): string | null {
  const value = query?.[key];
  if (typeof value === 'string') return cleanBoundedText(value, 300);
  if (Array.isArray(value)) return cleanBoundedText(value[0], 300);
  return null;
}

function normalizeLanguageCodes(value: unknown): Prisma.InputJsonValue[] | null {
  if (!Array.isArray(value)) return null;
  const output = value
    .slice(0, 20)
    .map((item) => cleanBoundedText(item, 16))
    .filter((item): item is string => Boolean(item));
  return output.length > 0 ? output : null;
}

function normalizeLanguageVoices(value: unknown): JsonObject | null {
  const input = asRecord(value);
  const output: JsonObject = {};
  for (const [languageCode, voiceId] of Object.entries(input).slice(0, 20)) {
    const normalizedLanguageCode = cleanBoundedText(languageCode, 16);
    const normalizedVoiceId = cleanBoundedText(voiceId, 128);
    if (!normalizedLanguageCode || !normalizedVoiceId) continue;
    output[normalizedLanguageCode] = normalizedVoiceId;
  }
  return Object.keys(output).length > 0 ? output : null;
}

export function normalizeProjectCreationAttemptPayload(input: unknown): NormalizedProjectCreationAttemptPayload {
  const source = asRecord(input);
  const query = normalizeQuery(source.query);
  const referrer = normalizeReferrer(source.referrer ?? source.referrerUrl);
  const result = normalizeEnum<ProjectCreationAttemptResult>(
    source.result,
    RESULT_SET,
    'paywall_shown',
  ) ?? 'paywall_shown';

  return {
    clientAttemptId: cleanBoundedText(source.clientAttemptId, 64) ?? randomUUID(),
    result,
    promptText: cleanBoundedText(source.promptText, LIMITS.promptMax),
    promptMode: normalizeEnum<ProjectCreationAttemptPromptMode>(source.promptMode, PROMPT_MODE_SET),
    projectExperience: normalizeEnum<ProjectCreationAttemptExperience>(source.projectExperience, EXPERIENCE_SET),
    durationSeconds: normalizeNonNegativeInt(source.durationSeconds, 1800),
    tokenCost: normalizeNonNegativeInt(source.tokenCost, 10_000_000),
    tokenBalance: normalizeNonNegativeInt(source.tokenBalance, 10_000_000),
    mainPageMode: cleanBoundedText(source.mainPageMode ?? firstQueryString(query, 'openMode'), 32),
    mainPageCategoryId: cleanBoundedText(source.mainPageCategoryId ?? firstQueryString(query, 'openCategory'), 64),
    characterSlug: cleanBoundedText(source.characterSlug, 191),
    templateId: normalizeUuid(source.templateId),
    utmSource: cleanBoundedText(source.utmSource ?? firstQueryString(query, 'utm_source'), 200),
    utmMedium: cleanBoundedText(source.utmMedium ?? firstQueryString(query, 'utm_medium'), 200),
    utmCampaign: cleanBoundedText(source.utmCampaign ?? firstQueryString(query, 'utm_campaign'), 200),
    utmContent: cleanBoundedText(source.utmContent ?? firstQueryString(query, 'utm_content'), 200),
    utmTerm: cleanBoundedText(source.utmTerm ?? firstQueryString(query, 'utm_term'), 200),
    intent: cleanBoundedText(source.intent ?? firstQueryString(query, 'intent'), 32),
    sourceToolSlug: cleanBoundedText(source.sourceToolSlug ?? firstQueryString(query, 'yc_t'), 191),
    referrerOrigin: referrer.origin,
    referrerPath: referrer.path,
    landingPath: normalizeLandingPath(source.landingPath),
    query,
    languageCodes: normalizeLanguageCodes(source.languageCodes),
    languageVoices: normalizeLanguageVoices(source.languageVoices),
    settingsSnapshot: sanitizeJsonValue(source.settingsSnapshot),
    rawContext: sanitizeJsonValue(source.rawContext),
  };
}

function jsonCreateField(value: Prisma.InputJsonValue | null | undefined) {
  return value == null ? undefined : value;
}

function buildAttemptCreateData(userId: string, normalized: NormalizedProjectCreationAttemptPayload): Prisma.ProjectCreationAttemptUncheckedCreateInput {
  return {
    userId,
    clientAttemptId: normalized.clientAttemptId,
    result: normalized.result,
    promptText: normalized.promptText,
    promptMode: normalized.promptMode,
    projectExperience: normalized.projectExperience,
    durationSeconds: normalized.durationSeconds,
    tokenCost: normalized.tokenCost,
    tokenBalance: normalized.tokenBalance,
    mainPageMode: normalized.mainPageMode,
    mainPageCategoryId: normalized.mainPageCategoryId,
    characterSlug: normalized.characterSlug,
    templateId: normalized.templateId,
    utmSource: normalized.utmSource,
    utmMedium: normalized.utmMedium,
    utmCampaign: normalized.utmCampaign,
    utmContent: normalized.utmContent,
    utmTerm: normalized.utmTerm,
    intent: normalized.intent,
    sourceToolSlug: normalized.sourceToolSlug,
    referrerOrigin: normalized.referrerOrigin,
    referrerPath: normalized.referrerPath,
    landingPath: normalized.landingPath,
    query: jsonCreateField(normalized.query),
    languageCodes: jsonCreateField(normalized.languageCodes),
    languageVoices: jsonCreateField(normalized.languageVoices),
    settingsSnapshot: jsonCreateField(normalized.settingsSnapshot),
    rawContext: jsonCreateField(normalized.rawContext),
  };
}

async function upsertUserAttribution(
  tx: Prisma.TransactionClient,
  userId: string,
  attemptId: string,
  normalized: NormalizedProjectCreationAttemptPayload,
) {
  const existing = await tx.userAttribution.findUnique({ where: { userId } });
  const createData: Prisma.UserAttributionUncheckedCreateInput = {
    userId,
    firstUtmSource: normalized.utmSource,
    lastUtmSource: normalized.utmSource,
    firstReferrerOrigin: normalized.referrerOrigin,
    firstReferrerPath: normalized.referrerPath,
    lastReferrerOrigin: normalized.referrerOrigin,
    lastReferrerPath: normalized.referrerPath,
    firstLandingPath: normalized.landingPath,
    lastLandingPath: normalized.landingPath,
    firstSourceToolSlug: normalized.sourceToolSlug,
    lastSourceToolSlug: normalized.sourceToolSlug,
    firstIntent: normalized.intent,
    lastIntent: normalized.intent,
    firstProjectPrompt: normalized.promptText,
    firstProjectPromptMode: normalized.promptMode,
    firstProjectExperience: normalized.projectExperience,
    firstMainPageMode: normalized.mainPageMode,
    firstMainPageCategoryId: normalized.mainPageCategoryId,
    firstCharacterSlug: normalized.characterSlug,
    firstTemplateId: normalized.templateId,
    firstProjectAttemptId: attemptId,
  };

  if (!existing) {
    await tx.userAttribution.create({ data: createData });
    return;
  }

  const data: Prisma.UserAttributionUncheckedUpdateInput = {};
  if (normalized.utmSource) data.lastUtmSource = normalized.utmSource;
  if (normalized.referrerOrigin) data.lastReferrerOrigin = normalized.referrerOrigin;
  if (normalized.referrerPath) data.lastReferrerPath = normalized.referrerPath;
  if (normalized.landingPath) data.lastLandingPath = normalized.landingPath;
  if (normalized.sourceToolSlug) data.lastSourceToolSlug = normalized.sourceToolSlug;
  if (normalized.intent) data.lastIntent = normalized.intent;

  if (!existing.firstUtmSource && normalized.utmSource) data.firstUtmSource = normalized.utmSource;
  if (!existing.firstReferrerOrigin && normalized.referrerOrigin) data.firstReferrerOrigin = normalized.referrerOrigin;
  if (!existing.firstReferrerPath && normalized.referrerPath) data.firstReferrerPath = normalized.referrerPath;
  if (!existing.firstLandingPath && normalized.landingPath) data.firstLandingPath = normalized.landingPath;
  if (!existing.firstSourceToolSlug && normalized.sourceToolSlug) data.firstSourceToolSlug = normalized.sourceToolSlug;
  if (!existing.firstIntent && normalized.intent) data.firstIntent = normalized.intent;
  if (!existing.firstProjectPrompt && normalized.promptText) data.firstProjectPrompt = normalized.promptText;
  if (!existing.firstProjectPromptMode && normalized.promptMode) data.firstProjectPromptMode = normalized.promptMode;
  if (!existing.firstProjectExperience && normalized.projectExperience) data.firstProjectExperience = normalized.projectExperience;
  if (!existing.firstMainPageMode && normalized.mainPageMode) data.firstMainPageMode = normalized.mainPageMode;
  if (!existing.firstMainPageCategoryId && normalized.mainPageCategoryId) data.firstMainPageCategoryId = normalized.mainPageCategoryId;
  if (!existing.firstCharacterSlug && normalized.characterSlug) data.firstCharacterSlug = normalized.characterSlug;
  if (!existing.firstTemplateId && normalized.templateId) data.firstTemplateId = normalized.templateId;
  if (!existing.firstProjectAttemptId) data.firstProjectAttemptId = attemptId;

  if (Object.keys(data).length === 0) return;
  await tx.userAttribution.update({ where: { userId }, data });
}

export async function recordProjectCreationAttempt(params: {
  userId: string;
  payload: unknown;
}) {
  const normalized = normalizeProjectCreationAttemptPayload(params.payload);
  const existing = await prisma.projectCreationAttempt.findUnique({
    where: {
      userId_clientAttemptId: {
        userId: params.userId,
        clientAttemptId: normalized.clientAttemptId,
      },
    },
  });
  if (existing) {
    return { attempt: existing, normalized, wasCreated: false };
  }

  try {
    const attempt = await prisma.$transaction(async (tx) => {
      const created = await tx.projectCreationAttempt.create({
        data: buildAttemptCreateData(params.userId, normalized),
      });
      await upsertUserAttribution(tx, params.userId, created.id, normalized);
      return created;
    });
    return { attempt, normalized, wasCreated: true };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const raced = await prisma.projectCreationAttempt.findUnique({
        where: {
          userId_clientAttemptId: {
            userId: params.userId,
            clientAttemptId: normalized.clientAttemptId,
          },
        },
      });
      if (raced) return { attempt: raced, normalized, wasCreated: false };
    }
    throw err;
  }
}

export async function linkProjectCreationAttemptToProject(params: {
  userId: string;
  attemptId: string | null | undefined;
  projectId: string;
}) {
  const attemptId = normalizeUuid(params.attemptId);
  if (!attemptId) return false;
  const result = await prisma.projectCreationAttempt.updateMany({
    where: {
      id: attemptId,
      userId: params.userId,
    },
    data: {
      projectId: params.projectId,
      result: 'project_created',
    },
  });
  return result.count > 0;
}
