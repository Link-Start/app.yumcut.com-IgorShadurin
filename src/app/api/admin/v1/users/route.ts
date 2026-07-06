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

const GUEST_EMAIL_SUFFIX = '@guest.yumcut';

const USER_FIELDS = [
  'id',
  'email',
  'name',
  'image',
  'createdAt',
  'preferredLanguage',
  'tokenBalance',
  'isAdmin',
  'isGuest',
  'deleted',
  'deletedAt',
  'emailReplyBonusGrantedAt',
  'emailReplyBonusSourceId',
  'subscriptionWinbackBonusPending',
  'subscriptionWinbackBonusGrantedAt',
  'projectCount',
] as const;

const DEFAULT_USER_FIELDS = [
  'id',
  'email',
  'name',
  'createdAt',
  'tokenBalance',
  'isAdmin',
  'deleted',
  'projectCount',
] as const satisfies readonly (typeof USER_FIELDS[number])[];

type UserField = typeof USER_FIELDS[number];

function serializeUser(row: any, fields: readonly UserField[]) {
  return pickFields(fields, {
    id: row.id,
    email: row.email,
    name: row.name ?? null,
    image: row.image ?? null,
    createdAt: isoDate(row.createdAt),
    preferredLanguage: row.preferredLanguage,
    tokenBalance: row.tokenBalance,
    isAdmin: row.isAdmin,
    isGuest: row.isGuest,
    deleted: row.deleted,
    deletedAt: isoDate(row.deletedAt),
    emailReplyBonusGrantedAt: isoDate(row.emailReplyBonusGrantedAt),
    emailReplyBonusSourceId: row.emailReplyBonusSourceId ?? null,
    subscriptionWinbackBonusPending: row.subscriptionWinbackBonusPending,
    subscriptionWinbackBonusGrantedAt: isoDate(row.subscriptionWinbackBonusGrantedAt),
    projectCount: row._count?.projects ?? 0,
  });
}

export const GET = withApiError(async function GET(req: NextRequest) {
  const auth = await requireAdminApiKey(req, 'read');
  if (!auth.context) return auth.error;

  const listParams = parseReadApiListParams(req.nextUrl.searchParams);
  if (!listParams.params) return listParams.error;

  const selection = resolveFieldSelection(req.nextUrl.searchParams, USER_FIELDS, DEFAULT_USER_FIELDS);
  if (!selection.fields) return selection.error;

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const includeDeleted = parseBooleanQuery(req.nextUrl.searchParams.get('includeDeleted'), false);
  const includeGuests = parseBooleanQuery(req.nextUrl.searchParams.get('includeGuests'), true);
  const filters: Array<Record<string, unknown>> = [];
  if (!includeDeleted) filters.push({ deleted: false });
  if (!includeGuests) filters.push({ email: { not: { endsWith: GUEST_EMAIL_SUFFIX } } });
  if (q) {
    filters.push({
      OR: [
        { id: { contains: q } },
        { email: { contains: q } },
        { name: { contains: q } },
      ],
    });
  }

  const rows = await prisma.user.findMany({
    where: andWhere(...filters, cursorWhere(listParams.params.cursor)),
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: listParams.params.limit + 1,
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      createdAt: true,
      preferredLanguage: true,
      tokenBalance: true,
      isAdmin: true,
      isGuest: true,
      deleted: true,
      deletedAt: true,
      emailReplyBonusGrantedAt: true,
      emailReplyBonusSourceId: true,
      subscriptionWinbackBonusPending: true,
      subscriptionWinbackBonusGrantedAt: true,
      _count: { select: { projects: true } },
    },
  });

  const visibleRows = rows.slice(0, listParams.params.limit);
  const last = visibleRows[visibleRows.length - 1] ?? null;
  return ok({
    items: visibleRows.map((row) => serializeUser(row, selection.fields)),
    limit: listParams.params.limit,
    nextCursor: rows.length > listParams.params.limit && last ? encodeReadApiCursor(last) : null,
  }, noStoreInit());
}, 'Failed to list admin API users');
