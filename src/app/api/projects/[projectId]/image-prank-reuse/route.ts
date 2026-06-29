import { NextRequest } from 'next/server';
import { prisma } from '@/server/db';
import { withApiError } from '@/server/errors';
import { ok, notFound, unauthorized } from '@/server/http';
import { authenticateApiRequest } from '@/server/api-user';
import { normalizeMediaUrl } from '@/server/storage';
import { normalizeImagePrankGenerationModel } from '@/shared/constants/image-generation';
import type { ImagePrankMode, ImagePrankReuseDTO, ImagePrankSourceImageDTO, ImagePrankSourceImageRole } from '@/shared/types';

type Params = { projectId: string };

const IMAGE_PRANK_MODES: ImagePrankMode[] = ['catalog', 'custom-two-image', 'custom-one-image'];
const IMAGE_PRANK_SOURCE_ROLES: ImagePrankSourceImageRole[] = ['prank', 'target', 'reference'];

function normalizeMode(value: unknown): ImagePrankMode | null {
  return typeof value === 'string' && (IMAGE_PRANK_MODES as string[]).includes(value) ? value as ImagePrankMode : null;
}

function normalizeRole(value: unknown): ImagePrankSourceImageRole {
  return typeof value === 'string' && (IMAGE_PRANK_SOURCE_ROLES as string[]).includes(value)
    ? value as ImagePrankSourceImageRole
    : 'reference';
}

function normalizeDimension(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function normalizeSourceImage(entry: unknown): ImagePrankSourceImageDTO | null {
  if (!entry || typeof entry !== 'object') return null;
  const source = entry as Record<string, unknown>;
  const imagePath = typeof source.imagePath === 'string' && source.imagePath.trim()
    ? source.imagePath.trim()
    : null;
  const imageUrl = typeof source.imageUrl === 'string' && source.imageUrl.trim()
    ? source.imageUrl.trim()
    : normalizeMediaUrl(imagePath);
  if (!imagePath || !imageUrl) return null;
  const previewImagePath = typeof source.previewImagePath === 'string' && source.previewImagePath.trim()
    ? source.previewImagePath.trim()
    : null;
  return {
    role: normalizeRole(source.role),
    label: typeof source.label === 'string' && source.label.trim() ? source.label.trim() : 'Reference image',
    imagePath,
    imageUrl,
    previewImagePath,
    previewImageUrl: typeof source.previewImageUrl === 'string' && source.previewImageUrl.trim()
      ? source.previewImageUrl.trim()
      : normalizeMediaUrl(previewImagePath),
    width: normalizeDimension(source.width),
    height: normalizeDimension(source.height),
  };
}

function normalizeCatalogItem(value: unknown): ImagePrankReuseDTO['catalogItem'] {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const id = typeof item.id === 'string' ? item.id : '';
  const slug = typeof item.slug === 'string' ? item.slug : '';
  if (!id || !slug) return null;
  return {
    id,
    slug,
    title: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : 'Image Prank',
    categoryTitle: typeof item.categoryTitle === 'string' && item.categoryTitle.trim() ? item.categoryTitle.trim() : null,
  };
}

function pickImagePrankPayload(...candidates: unknown[]) {
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    const record = candidate as Record<string, unknown>;
    if (record.imageKind === 'image-prank' && record.imagePrank && typeof record.imagePrank === 'object') {
      return {
        imagePrank: record.imagePrank as Record<string, unknown>,
        userPrompt: typeof record.userPrompt === 'string' ? record.userPrompt : null,
      };
    }
    if (record.mode && record.sourceImages) {
      return {
        imagePrank: record,
        userPrompt: typeof record.userPrompt === 'string' ? record.userPrompt : null,
      };
    }
  }
  return null;
}

export const GET = withApiError(async function GET(req: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await authenticateApiRequest(req);
  if (!auth) return unauthorized();
  const { projectId } = await params;

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: auth.userId, deleted: false },
    select: { id: true, prompt: true },
  });
  if (!project) return notFound('Project not found');

  const [job, statusLog] = await Promise.all([
    prisma.job.findFirst({
      where: { projectId: project.id },
      orderBy: { createdAt: 'asc' },
      select: { payload: true },
    }),
    prisma.projectStatusHistory.findFirst({
      where: { projectId: project.id },
      orderBy: { createdAt: 'desc' },
      select: { extra: true },
    }),
  ]);

  const picked = pickImagePrankPayload(job?.payload, statusLog?.extra);
  if (!picked) return notFound('Image Prank data not found');

  const mode = normalizeMode(picked.imagePrank.mode);
  if (!mode) return notFound('Image Prank data not found');

  const sourceImages = Array.isArray(picked.imagePrank.sourceImages)
    ? picked.imagePrank.sourceImages.map(normalizeSourceImage).filter(Boolean) as ImagePrankSourceImageDTO[]
    : [];
  if (sourceImages.length === 0) return notFound('Image Prank source images not found');

  const prompt = picked.userPrompt
    || (typeof picked.imagePrank.userPrompt === 'string' ? picked.imagePrank.userPrompt : null)
    || project.prompt
    || '';

  return ok<ImagePrankReuseDTO>({
    projectId: project.id,
    mode,
    model: normalizeImagePrankGenerationModel(
      typeof picked.imagePrank.model === 'string' ? picked.imagePrank.model : null,
    ),
    prompt,
    catalogItem: normalizeCatalogItem(picked.imagePrank.catalogItem),
    sourceImages,
  });
}, 'Failed to load reusable Image Prank data');
