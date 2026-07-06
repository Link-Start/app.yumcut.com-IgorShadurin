import { NextRequest } from 'next/server';
import { prisma } from '@/server/db';
import { withApiError } from '@/server/errors';
import { error, ok } from '@/server/http';
import { requireAdminApiKey } from '@/server/admin/api-auth';
import {
  andWhere,
  cursorWhere,
  encodeReadApiCursor,
  isoDate,
  noStoreInit,
  parseDateQuery,
  parseReadApiListParams,
  pickFields,
  resolveFieldSelection,
} from '@/server/admin/read-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ATTEMPT_FIELDS = [
  'id',
  'userId',
  'projectId',
  'clientAttemptId',
  'result',
  'promptText',
  'promptMode',
  'projectExperience',
  'durationSeconds',
  'tokenCost',
  'tokenBalance',
  'mainPageMode',
  'mainPageCategoryId',
  'characterSlug',
  'templateId',
  'utmSource',
  'utmMedium',
  'utmCampaign',
  'utmContent',
  'utmTerm',
  'intent',
  'sourceToolSlug',
  'referrerOrigin',
  'referrerPath',
  'landingPath',
  'query',
  'languageCodes',
  'languageVoices',
  'settingsSnapshot',
  'rawContext',
  'createdAt',
  'updatedAt',
  'user',
] as const;

const DEFAULT_ATTEMPT_FIELDS = [
  'id',
  'userId',
  'projectId',
  'result',
  'promptText',
  'promptMode',
  'projectExperience',
  'tokenCost',
  'tokenBalance',
  'mainPageMode',
  'characterSlug',
  'createdAt',
  'user',
] as const satisfies readonly (typeof ATTEMPT_FIELDS[number])[];

type AttemptField = typeof ATTEMPT_FIELDS[number];

function parseOptionalDate(searchParams: URLSearchParams, key: string, endOfDay = false): Date | Response | null {
  const raw = searchParams.get(key);
  if (!raw?.trim()) return null;
  const parsed = parseDateQuery(raw, endOfDay);
  return parsed ?? error('VALIDATION_ERROR', `${key} must be a valid date`, 400);
}

function serializeAttempt(row: any, fields: readonly AttemptField[]) {
  return pickFields(fields, {
    id: row.id,
    userId: row.userId,
    projectId: row.projectId ?? null,
    clientAttemptId: row.clientAttemptId,
    result: row.result,
    promptText: row.promptText ?? null,
    promptMode: row.promptMode ?? null,
    projectExperience: row.projectExperience ?? null,
    durationSeconds: row.durationSeconds ?? null,
    tokenCost: row.tokenCost ?? null,
    tokenBalance: row.tokenBalance ?? null,
    mainPageMode: row.mainPageMode ?? null,
    mainPageCategoryId: row.mainPageCategoryId ?? null,
    characterSlug: row.characterSlug ?? null,
    templateId: row.templateId ?? null,
    utmSource: row.utmSource ?? null,
    utmMedium: row.utmMedium ?? null,
    utmCampaign: row.utmCampaign ?? null,
    utmContent: row.utmContent ?? null,
    utmTerm: row.utmTerm ?? null,
    intent: row.intent ?? null,
    sourceToolSlug: row.sourceToolSlug ?? null,
    referrerOrigin: row.referrerOrigin ?? null,
    referrerPath: row.referrerPath ?? null,
    landingPath: row.landingPath ?? null,
    query: row.query ?? null,
    languageCodes: row.languageCodes ?? null,
    languageVoices: row.languageVoices ?? null,
    settingsSnapshot: row.settingsSnapshot ?? null,
    rawContext: row.rawContext ?? null,
    createdAt: isoDate(row.createdAt),
    updatedAt: isoDate(row.updatedAt),
    user: row.user
      ? {
          id: row.user.id,
          email: row.user.email ?? null,
          name: row.user.name ?? null,
          isAdmin: row.user.isAdmin,
          createdAt: isoDate(row.user.createdAt),
        }
      : null,
  });
}

export const GET = withApiError(async function GET(req: NextRequest) {
  const auth = await requireAdminApiKey(req, 'read');
  if (!auth.context) return auth.error;

  const listParams = parseReadApiListParams(req.nextUrl.searchParams);
  if (!listParams.params) return listParams.error;

  const selection = resolveFieldSelection(req.nextUrl.searchParams, ATTEMPT_FIELDS, DEFAULT_ATTEMPT_FIELDS);
  if (!selection.fields) return selection.error;

  const from = parseOptionalDate(req.nextUrl.searchParams, 'from', false);
  if (from instanceof Response) return from;
  const to = parseOptionalDate(req.nextUrl.searchParams, 'to', true);
  if (to instanceof Response) return to;
  if (from && to && from > to) {
    return error('VALIDATION_ERROR', 'from must be before to', 400);
  }

  const result = req.nextUrl.searchParams.get('result')?.trim();
  const userId = req.nextUrl.searchParams.get('userId')?.trim();
  const projectId = req.nextUrl.searchParams.get('projectId')?.trim();
  const q = req.nextUrl.searchParams.get('q')?.trim();
  const createdAt: { gte?: Date; lte?: Date } = {};
  if (from) createdAt.gte = from;
  if (to) createdAt.lte = to;
  const filters: Array<Record<string, unknown>> = [];
  if (result) filters.push({ result });
  if (userId) filters.push({ userId });
  if (projectId) filters.push({ projectId });
  if (Object.keys(createdAt).length > 0) filters.push({ createdAt });
  if (q) {
    filters.push({
      OR: [
        { id: { contains: q } },
        { userId: { contains: q } },
        { projectId: { contains: q } },
        { promptText: { contains: q } },
        { characterSlug: { contains: q } },
        { user: { email: { contains: q } } },
        { user: { name: { contains: q } } },
      ],
    });
  }

  const rows = await prisma.projectCreationAttempt.findMany({
    where: andWhere(...filters, cursorWhere(listParams.params.cursor)),
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          isAdmin: true,
          createdAt: true,
        },
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: listParams.params.limit + 1,
  });

  const visibleRows = rows.slice(0, listParams.params.limit);
  const last = visibleRows[visibleRows.length - 1] ?? null;
  return ok({
    items: visibleRows.map((row) => serializeAttempt(row, selection.fields)),
    limit: listParams.params.limit,
    nextCursor: rows.length > listParams.params.limit && last ? encodeReadApiCursor(last) : null,
  }, noStoreInit());
}, 'Failed to list admin API project attempts');
