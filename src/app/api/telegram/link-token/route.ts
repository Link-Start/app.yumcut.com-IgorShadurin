import { ok, unauthorized, forbidden } from '@/server/http';
import { withApiError } from '@/server/errors';
import { createTelegramLinkToken, isTelegramEnabled } from '@/server/telegram';
import { authenticateApiRequest } from '@/server/api-user';

export const POST = withApiError(async function POST(req: Request) {
  const auth = await authenticateApiRequest(req as any);
  if (!auth) return unauthorized();
  if (!isTelegramEnabled()) {
    return forbidden('Telegram integration is not configured');
  }
  const userId = auth.userId;
  const token = await createTelegramLinkToken(userId);
  return ok({
    code: token.code,
    deepLinkUrl: token.deepLink,
    expiresAt: token.expiresAt.toISOString(),
  });
}, 'Failed to create Telegram link token');
