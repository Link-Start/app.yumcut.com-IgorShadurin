import { withApiError } from '@/server/errors';
import { notFound, ok, unauthorized } from '@/server/http';
import { getAuthSession } from '@/server/auth';
import { revokeUserApiKey } from '@/server/user-api/api-keys';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { id: string };

function sessionUserId(session: Awaited<ReturnType<typeof getAuthSession>>) {
  const userId = session?.user && (session.user as any).id;
  return typeof userId === 'string' && userId ? userId : null;
}

export const DELETE = withApiError(async function DELETE(_req: Request, { params }: { params: Promise<Params> }) {
  const session = await getAuthSession();
  const userId = sessionUserId(session);
  if (!userId) return unauthorized();

  const { id } = await params;
  const item = await revokeUserApiKey({
    userId,
    id,
  });
  if (!item) return notFound('API key not found');
  return ok({ item }, { headers: { 'cache-control': 'no-store' } });
}, 'Failed to revoke user API key');
