import { withApiError } from '@/server/errors';
import { ok, unauthorized, forbidden } from '@/server/http';
import { isPublishSchedulerEnabledForUser } from '@/server/features/publish-scheduler';
import { revokePublishChannelTokens } from '@/server/publishing/channels';
import { authenticateApiRequest } from '@/server/api-user';

type Params = { channelId: string };

export const POST = withApiError(async function POST(req: Request, { params }: { params: Promise<Params> }) {
  const auth = await authenticateApiRequest(req as any);
  if (!auth) return unauthorized();
  const userId = auth.userId;
  if (!isPublishSchedulerEnabledForUser({ id: userId })) {
    return forbidden('Scheduler is disabled');
  }
  const { channelId } = await params;
  await revokePublishChannelTokens(userId, channelId);
  return ok({ revoked: true });
}, 'Failed to revoke channel tokens');
