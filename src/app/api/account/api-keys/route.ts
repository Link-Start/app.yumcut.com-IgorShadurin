import { z } from 'zod';
import { withApiError } from '@/server/errors';
import { error, ok, unauthorized } from '@/server/http';
import { getAuthSession } from '@/server/auth';
import {
  createUserApiKey,
  listUserApiKeys,
  normalizeUserApiKeyName,
} from '@/server/user-api/api-keys';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  scopes: z.array(z.enum(['read', 'write'])).optional(),
});

function sessionUserId(session: Awaited<ReturnType<typeof getAuthSession>>) {
  const userId = session?.user && (session.user as any).id;
  return typeof userId === 'string' && userId ? userId : null;
}

export const GET = withApiError(async function GET() {
  const session = await getAuthSession();
  const userId = sessionUserId(session);
  if (!userId) return unauthorized();

  const items = await listUserApiKeys(userId);
  return ok({ items }, { headers: { 'cache-control': 'no-store' } });
}, 'Failed to list user API keys');

export const POST = withApiError(async function POST(req: Request) {
  const session = await getAuthSession();
  const userId = sessionUserId(session);
  if (!userId) return unauthorized();

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return error('VALIDATION_ERROR', 'Invalid API key payload', 400, parsed.error.flatten());
  }

  const result = await createUserApiKey({
    userId,
    name: normalizeUserApiKeyName(parsed.data.name),
    scopes: parsed.data.scopes,
  });
  return ok(result, { headers: { 'cache-control': 'no-store' } });
}, 'Failed to create user API key');
