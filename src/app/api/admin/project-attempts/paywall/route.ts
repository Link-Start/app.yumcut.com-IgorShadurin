import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/server/admin';
import { withApiError } from '@/server/errors';
import { error, ok } from '@/server/http';
import { exportAdminPaywallAttempts, listAdminPaywallAttempts } from '@/server/admin/project-attempts';

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseDateParam(value: string | null, endOfDay = false) {
  const normalized = value?.trim();
  if (!normalized) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(normalized)
    ? new Date(`${normalized}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`)
    : new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateForFilename(value: Date | null, fallback: string) {
  return value ? value.toISOString().slice(0, 10) : fallback;
}

export const GET = withApiError(async function GET(req: NextRequest) {
  const { session, error: authError } = await requireAdminApiSession();
  if (!session) return authError;

  const from = parseDateParam(req.nextUrl.searchParams.get('from'), false);
  const to = parseDateParam(req.nextUrl.searchParams.get('to'), true);
  if (from && to && from > to) {
    return error('VALIDATION_ERROR', 'Date from must be before date to', 400);
  }

  const input = {
    page: parsePositiveInt(req.nextUrl.searchParams.get('page'), 1),
    pageSize: parsePositiveInt(req.nextUrl.searchParams.get('pageSize'), 50),
    from,
    to,
    userId: req.nextUrl.searchParams.get('userId'),
    q: req.nextUrl.searchParams.get('q'),
  };

  if (req.nextUrl.searchParams.get('export') === '1') {
    const items = await exportAdminPaywallAttempts(input);
    const filename = `paywall-attempts_${dateForFilename(from, 'all')}_${dateForFilename(to, 'now')}.json`;
    return new NextResponse(JSON.stringify({
      exportedAt: new Date().toISOString(),
      from: from?.toISOString() ?? null,
      to: to?.toISOString() ?? null,
      total: items.length,
      items,
    }, null, 2), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="${filename}"`,
        'cache-control': 'no-store',
      },
    });
  }

  return ok(await listAdminPaywallAttempts(input), {
    headers: { 'cache-control': 'no-store' },
  });
}, 'Failed to load paywall attempt logs');
