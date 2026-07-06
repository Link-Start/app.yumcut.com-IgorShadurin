import { NextRequest } from 'next/server';
import { prisma } from '@/server/db';
import { withApiError } from '@/server/errors';
import { ok } from '@/server/http';
import { requireAdminApiKey } from '@/server/admin/api-auth';
import {
  andWhere,
  cursorWhere,
  encodeReadApiCursor,
  isoDate,
  noStoreInit,
  parseBooleanQuery,
  parseReadApiListParams,
  pickFields,
  resolveFieldSelection,
} from '@/server/admin/read-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROJECT_FIELDS = [
  'id',
  'userId',
  'title',
  'prompt',
  'rawScript',
  'finalScriptText',
  'finalVoiceoverUrl',
  'finalVideoUrl',
  'status',
  'deleted',
  'deletedAt',
  'createdAt',
  'updatedAt',
  'languages',
  'groupId',
  'templateId',
  'currentDaemonId',
  'user',
  'counts',
] as const;

const DEFAULT_PROJECT_FIELDS = [
  'id',
  'userId',
  'title',
  'status',
  'createdAt',
  'updatedAt',
  'user',
] as const satisfies readonly (typeof PROJECT_FIELDS[number])[];

type ProjectField = typeof PROJECT_FIELDS[number];

function serializeProject(row: any, fields: readonly ProjectField[]) {
  return pickFields(fields, {
    id: row.id,
    userId: row.userId,
    title: row.title,
    prompt: row.prompt ?? null,
    rawScript: row.rawScript ?? null,
    finalScriptText: row.finalScriptText ?? null,
    finalVoiceoverUrl: row.finalVoiceoverUrl ?? null,
    finalVideoUrl: row.finalVideoUrl ?? null,
    status: row.status,
    deleted: row.deleted,
    deletedAt: isoDate(row.deletedAt),
    createdAt: isoDate(row.createdAt),
    updatedAt: isoDate(row.updatedAt),
    languages: row.languages ?? null,
    groupId: row.groupId ?? null,
    templateId: row.templateId ?? null,
    currentDaemonId: row.currentDaemonId ?? null,
    user: row.user
      ? {
          id: row.user.id,
          email: row.user.email,
          name: row.user.name ?? null,
        }
      : null,
    counts: {
      scripts: row._count?.scripts ?? 0,
      audios: row._count?.audios ?? 0,
      videos: row._count?.videos ?? 0,
      images: row._count?.images ?? 0,
      artifacts: row._count?.artifacts ?? 0,
      statusLog: row._count?.statusLog ?? 0,
      jobs: row._count?.jobs ?? 0,
      creationAttempts: row._count?.creationAttempts ?? 0,
    },
  });
}

export const GET = withApiError(async function GET(req: NextRequest) {
  const auth = await requireAdminApiKey(req, 'read');
  if (!auth.context) return auth.error;

  const listParams = parseReadApiListParams(req.nextUrl.searchParams);
  if (!listParams.params) return listParams.error;

  const selection = resolveFieldSelection(req.nextUrl.searchParams, PROJECT_FIELDS, DEFAULT_PROJECT_FIELDS);
  if (!selection.fields) return selection.error;

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const status = req.nextUrl.searchParams.get('status')?.trim() ?? '';
  const userId = req.nextUrl.searchParams.get('userId')?.trim() ?? '';
  const includeDeleted = parseBooleanQuery(req.nextUrl.searchParams.get('includeDeleted'), false);
  const filters: Array<Record<string, unknown>> = [];
  if (!includeDeleted) filters.push({ deleted: false });
  if (status) filters.push({ status });
  if (userId) filters.push({ userId });
  if (q) {
    filters.push({
      OR: [
        { id: { contains: q } },
        { title: { contains: q } },
        { prompt: { contains: q } },
        { user: { email: { contains: q } } },
        { user: { name: { contains: q } } },
      ],
    });
  }

  const rows = await prisma.project.findMany({
    where: andWhere(...filters, cursorWhere(listParams.params.cursor)),
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: listParams.params.limit + 1,
    select: {
      id: true,
      userId: true,
      title: true,
      prompt: true,
      rawScript: true,
      finalScriptText: true,
      finalVoiceoverUrl: true,
      finalVideoUrl: true,
      status: true,
      deleted: true,
      deletedAt: true,
      createdAt: true,
      updatedAt: true,
      languages: true,
      groupId: true,
      templateId: true,
      currentDaemonId: true,
      user: { select: { id: true, email: true, name: true } },
      _count: {
        select: {
          scripts: true,
          audios: true,
          videos: true,
          images: true,
          artifacts: true,
          statusLog: true,
          jobs: true,
          creationAttempts: true,
        },
      },
    },
  });

  const visibleRows = rows.slice(0, listParams.params.limit);
  const last = visibleRows[visibleRows.length - 1] ?? null;
  return ok({
    items: visibleRows.map((row) => serializeProject(row, selection.fields)),
    limit: listParams.params.limit,
    nextCursor: rows.length > listParams.params.limit && last ? encodeReadApiCursor(last) : null,
  }, noStoreInit());
}, 'Failed to list admin API projects');
