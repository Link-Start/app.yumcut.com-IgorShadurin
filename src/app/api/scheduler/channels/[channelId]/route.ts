import { withApiError } from '@/server/errors';
import { ok, unauthorized, forbidden, notFound } from '@/server/http';
import { isPublishSchedulerEnabledForUser } from '@/server/features/publish-scheduler';
import { deletePublishChannel } from '@/server/publishing/channels';
import { authenticateApiRequest } from '@/server/api-user';

type Params = { channelId: string };

export const DELETE = withApiError(async function DELETE(req: Request, { params }: { params: Promise<Params> }) {
  const auth = await authenticateApiRequest(req as any);
  if (!auth) return unauthorized();
  const userId = auth.userId;
  if (!isPublishSchedulerEnabledForUser({ id: userId })) {
    return forbidden('Scheduler is disabled');
  }
  const { channelId } = await params;
  try {
    await deletePublishChannel(userId, channelId);
  } catch (err) {
    return notFound('Channel not found');
  }
  return ok({ removed: true });
}, 'Failed to disconnect channel');
