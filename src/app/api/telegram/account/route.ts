import { NextRequest } from 'next/server';
import { ok, unauthorized } from '@/server/http';
import { withApiError } from '@/server/errors';
import { getTelegramAccount, disconnectTelegramForUser, isTelegramEnabled } from '@/server/telegram';
import { authenticateApiRequest } from '@/server/api-user';

export const GET = withApiError(async function GET(req: NextRequest) {
  const auth = await authenticateApiRequest(req);
  if (!auth) return unauthorized();
  const userId = auth.userId;
  const account = await getTelegramAccount(userId);
  return ok({
    connected: !!account,
    account: account
      ? {
          username: account.username,
          firstName: account.firstName,
          lastName: account.lastName,
          linkedAt: account.linkedAt.toISOString(),
        }
      : null,
    enabled: isTelegramEnabled(),
  });
}, 'Failed to load Telegram account');

export const DELETE = withApiError(async function DELETE(_req: NextRequest) {
  const auth = await authenticateApiRequest(_req);
  if (!auth) return unauthorized();
  const userId = auth.userId;
  await disconnectTelegramForUser(userId);
  return ok({ ok: true });
}, 'Failed to disconnect Telegram account');
