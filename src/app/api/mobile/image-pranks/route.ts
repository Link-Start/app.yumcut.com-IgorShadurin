import { NextRequest } from 'next/server';
import { ok } from '@/server/http';
import { withApiError } from '@/server/errors';
import { listPublicImagePrankCatalog } from '@/server/image-pranks';
import { requireMobileUserId } from '../shared/auth';

export const GET = withApiError(async function GET(req: NextRequest) {
  const auth = await requireMobileUserId(req);
  if ('error' in auth) return auth.error;
  return ok(await listPublicImagePrankCatalog());
}, 'Failed to load mobile image prank catalog');
