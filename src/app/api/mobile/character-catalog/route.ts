import { NextRequest } from 'next/server';
import { ok } from '@/server/http';
import { withApiError } from '@/server/errors';
import { requireMobileUserId } from '../shared/auth';
import { listMobileCharacterCatalog } from '@/server/character-catalog';

export const GET = withApiError(async function GET(req: NextRequest) {
  const auth = await requireMobileUserId(req);
  if ('error' in auth) {
    return auth.error;
  }

  const categories = await listMobileCharacterCatalog(auth.userId);
  return ok({ categories });
}, 'Failed to load mobile character catalog');
