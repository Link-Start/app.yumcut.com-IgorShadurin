import { z } from 'zod';
import { withApiError } from '@/server/errors';
import { error, ok } from '@/server/http';
import { requireAdminApiSession } from '@/server/admin';
import {
  createAdminApiKey,
  listAdminApiKeys,
  normalizeAdminApiKeyName,
} from '@/server/admin/api-keys';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  scopes: z.array(z.enum(['read', 'write'])).optional(),
});

export const GET = withApiError(async function GET() {
  const { session, error: authError } = await requireAdminApiSession();
  if (!session) return authError;

  const items = await listAdminApiKeys();
  return ok({ items }, { headers: { 'cache-control': 'no-store' } });
}, 'Failed to list admin API keys');

export const POST = withApiError(async function POST(req: Request) {
  const { session, error: authError } = await requireAdminApiSession();
  if (!session) return authError;

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return error('VALIDATION_ERROR', 'Invalid API key payload', 400, parsed.error.flatten());
  }

  const createdByUserId = (session.user as any).id as string;
  const result = await createAdminApiKey({
    name: normalizeAdminApiKeyName(parsed.data.name),
    createdByUserId,
    scopes: parsed.data.scopes,
  });
  return ok(result, { headers: { 'cache-control': 'no-store' } });
}, 'Failed to create admin API key');
