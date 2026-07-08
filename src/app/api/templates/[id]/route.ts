import { NextRequest } from 'next/server';
import { prisma } from '@/server/db';
import { withApiError } from '@/server/errors';
import { ok, notFound } from '@/server/http';
import { authenticateApiRequest } from '@/server/api-user';

export const GET = withApiError(async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authenticateApiRequest(req);
  const userId = auth?.userId;
  const isAdmin = !!auth?.sessionUser?.isAdmin;

  const tpl = await prisma.template.findUnique({
    where: { id },
    select: {
      id: true,
      ownerId: true,
      title: true,
      description: true,
      previewImageUrl: true,
      previewVideoUrl: true,
      textPrompt: true,
      weight: true,
      isPublic: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!tpl) return notFound();
  if (!isAdmin && !(tpl.isPublic || (userId && tpl.ownerId === userId))) {
    return notFound();
  }
  // Do not leak ownerId to non-admins
  const { ownerId: _ownerId, ...safe } = tpl as any;
  return ok(safe);
}, 'Failed to load template');
