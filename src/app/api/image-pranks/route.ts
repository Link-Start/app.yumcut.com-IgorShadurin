import { ok } from '@/server/http';
import { withApiError } from '@/server/errors';
import { listPublicImagePrankCatalog } from '@/server/image-pranks';

export const GET = withApiError(async function GET() {
  return ok(await listPublicImagePrankCatalog());
}, 'Failed to load image prank catalog');
