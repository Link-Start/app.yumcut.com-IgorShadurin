import { NextRequest } from 'next/server';
import { withApiError } from '@/server/errors';
import { requireAdminApiSession } from '@/server/admin';
import { ok } from '@/server/http';
import { searchUsersByEmailOrName } from '@/server/admin/users';

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 160;

function parseLimit(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

function parseBooleanQuery(value: string | null, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

export const GET = withApiError(async function GET(req: NextRequest) {
  const { session, error } = await requireAdminApiSession();
  if (!session) return error;

  const query = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, MAX_QUERY_LENGTH);
  if (query.length < MIN_QUERY_LENGTH) {
    return ok({ items: [] });
  }

  const includeGuestUsers = parseBooleanQuery(req.nextUrl.searchParams.get('includeGuestUsers'), true);
  const includeDeleted = parseBooleanQuery(req.nextUrl.searchParams.get('includeDeleted'), true);
  const limit = parseLimit(req.nextUrl.searchParams.get('limit'));

  const items = await searchUsersByEmailOrName({
    query,
    limit,
    includeGuestUsers,
    includeDeleted,
  });

  return ok({ items });
}, 'Failed to search users');
