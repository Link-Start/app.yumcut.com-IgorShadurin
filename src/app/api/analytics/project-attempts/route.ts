import { NextRequest } from 'next/server';
import { withApiError } from '@/server/errors';
import { ok, unauthorized } from '@/server/http';
import { authenticateApiRequest } from '@/server/api-user';
import { recordProjectCreationAttempt } from '@/server/analytics/project-attempts';

export const POST = withApiError(async function POST(req: NextRequest) {
  const auth = await authenticateApiRequest(req);
  if (!auth) return unauthorized();

  const payload = await req.json().catch(() => ({}));
  const { attempt } = await recordProjectCreationAttempt({
    userId: auth.userId,
    payload,
  });

  return ok({
    id: attempt.id,
    clientAttemptId: attempt.clientAttemptId,
    result: attempt.result,
  });
}, 'Failed to record project creation attempt');
