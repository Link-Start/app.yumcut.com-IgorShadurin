import { NextRequest } from 'next/server';
import { withApiError } from '@/server/errors';
import { requireAdminApiSession } from '@/server/admin';
import { ok } from '@/server/http';
import { updateAdminCharacterCategory } from '@/server/admin/characters';

export const PATCH = withApiError(async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAdminApiSession();
  if (!session) return error;

  const { id } = await params;
  const body = await req.json();
  const updated = await updateAdminCharacterCategory(id, {
    slug: typeof body?.slug === 'string' ? body.slug : undefined,
    title: typeof body?.title === 'string' ? body.title : undefined,
    isActive: typeof body?.isActive === 'boolean' ? body.isActive : undefined,
    priority: typeof body?.priority === 'number' ? body.priority : undefined,
  });

  return ok(updated);
}, 'Failed to update character category');
