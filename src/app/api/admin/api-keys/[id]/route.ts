import { withApiError } from '@/server/errors';
import { notFound, ok } from '@/server/http';
import { requireAdminApiSession } from '@/server/admin';
import { revokeAdminApiKey } from '@/server/admin/api-keys';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { id: string };

export const DELETE = withApiError(async function DELETE(_req: Request, { params }: { params: Promise<Params> }) {
  const { session, error: authError } = await requireAdminApiSession();
  if (!session) return authError;

  const { id } = await params;
  const item = await revokeAdminApiKey({
    id,
    revokedByUserId: (session.user as any).id as string,
  });
  if (!item) return notFound('API key not found');
  return ok({ item }, { headers: { 'cache-control': 'no-store' } });
}, 'Failed to revoke admin API key');
