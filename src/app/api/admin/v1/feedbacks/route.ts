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

const FEEDBACK_FIELDS = [
  'id',
  'emailId',
  'fromEmail',
  'fromRaw',
  'toRecipients',
  'subject',
  'latestReplyText',
  'snippetSource',
  'userId',
  'replyBonus',
  'inboundFetchError',
  'telegramForwardError',
  'enriched',
  'forwardedToTelegram',
  'createdAt',
  'updatedAt',
  'user',
] as const;

const DEFAULT_FEEDBACK_FIELDS = [
  'id',
  'emailId',
  'fromEmail',
  'subject',
  'latestReplyText',
  'snippetSource',
  'userId',
  'createdAt',
  'user',
] as const satisfies readonly (typeof FEEDBACK_FIELDS[number])[];

type FeedbackField = typeof FEEDBACK_FIELDS[number];

function parseOptionalDate(searchParams: URLSearchParams, key: string, endOfDay = false): Date | Response | null {
  const raw = searchParams.get(key);
  if (!raw?.trim()) return null;
  const parsed = parseDateQuery(raw, endOfDay);
  return parsed ?? error('VALIDATION_ERROR', `${key} must be a valid date`, 400);
}

function serializeFeedback(row: any, fields: readonly FeedbackField[]) {
  return pickFields(fields, {
    id: row.id,
    emailId: row.emailId,
    fromEmail: row.fromEmail ?? null,
    fromRaw: row.fromRaw ?? null,
    toRecipients: row.toRecipients ?? null,
    subject: row.subject ?? null,
    latestReplyText: row.latestReplyText ?? null,
    snippetSource: row.snippetSource,
    userId: row.userId ?? null,
    replyBonus: row.replyBonus ?? null,
    inboundFetchError: row.inboundFetchError ?? null,
    telegramForwardError: row.telegramForwardError ?? null,
    enriched: row.enriched,
    forwardedToTelegram: row.forwardedToTelegram,
    createdAt: isoDate(row.createdAt),
    updatedAt: isoDate(row.updatedAt),
    user: row.user
      ? {
          id: row.user.id,
          email: row.user.email,
          name: row.user.name ?? null,
          isAdmin: row.user.isAdmin,
        }
      : null,
  });
}

export const GET = withApiError(async function GET(req: NextRequest) {
  const auth = await requireAdminApiKey(req, 'read');
  if (!auth.context) return auth.error;

  const listParams = parseReadApiListParams(req.nextUrl.searchParams);
  if (!listParams.params) return listParams.error;

  const selection = resolveFieldSelection(req.nextUrl.searchParams, FEEDBACK_FIELDS, DEFAULT_FEEDBACK_FIELDS);
  if (!selection.fields) return selection.error;

  const from = parseOptionalDate(req.nextUrl.searchParams, 'from', false);
  if (from instanceof Response) return from;
  const to = parseOptionalDate(req.nextUrl.searchParams, 'to', true);
  if (to instanceof Response) return to;
  if (from && to && from > to) {
    return error('VALIDATION_ERROR', 'from must be before to', 400);
  }

  const q = req.nextUrl.searchParams.get('q')?.trim();
  const userId = req.nextUrl.searchParams.get('userId')?.trim();
  const fromEmail = req.nextUrl.searchParams.get('fromEmail')?.trim().toLowerCase();
  const createdAt: { gte?: Date; lte?: Date } = {};
  if (from) createdAt.gte = from;
  if (to) createdAt.lte = to;
  const filters: Array<Record<string, unknown>> = [];
  if (userId) filters.push({ userId });
  if (fromEmail) filters.push({ fromEmail });
  if (Object.keys(createdAt).length > 0) filters.push({ createdAt });
  if (q) {
    filters.push({
      OR: [
        { emailId: { contains: q } },
        { fromEmail: { contains: q } },
        { fromRaw: { contains: q } },
        { subject: { contains: q } },
        { latestReplyText: { contains: q } },
        { user: { email: { contains: q } } },
        { user: { name: { contains: q } } },
      ],
    });
  }

  const rows = await (prisma as any).inboundFeedback.findMany({
    where: andWhere(...filters, cursorWhere(listParams.params.cursor)),
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          isAdmin: true,
        },
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: listParams.params.limit + 1,
  });

  const visibleRows = rows.slice(0, listParams.params.limit);
  const last = visibleRows[visibleRows.length - 1] ?? null;
  return ok({
    items: visibleRows.map((row: any) => serializeFeedback(row, selection.fields)),
    limit: listParams.params.limit,
    nextCursor: rows.length > listParams.params.limit && last ? encodeReadApiCursor(last) : null,
  }, noStoreInit());
}, 'Failed to list admin API feedbacks');
