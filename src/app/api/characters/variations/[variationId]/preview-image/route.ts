import { NextRequest, NextResponse } from 'next/server';
import { error, notFound } from '@/server/http';
import { withApiError } from '@/server/errors';
import { prisma } from '@/server/db';
import {
  CHARACTER_CATALOG_PREVIEW_IMAGE_KIND,
  isAllowedCharacterPreviewHeight,
} from '@/server/character-preview-images';
import { normalizeMediaUrl, prepareCharacterPreviewImageVariantInStorage } from '@/server/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = {
  variationId: string;
};

function parseHeight(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('h');
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isSafeInteger(parsed)) return null;
  return parsed;
}

function redirectToMedia(req: NextRequest, url: string) {
  return NextResponse.redirect(new URL(url, req.nextUrl.origin), 307);
}

export const GET = withApiError(async function GET(
  req: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const height = parseHeight(req);
  if (!height || !isAllowedCharacterPreviewHeight(height)) {
    return error('VALIDATION_ERROR', 'Unsupported preview image height', 400);
  }

  const { variationId } = await params;
  if (!variationId || variationId.trim().length === 0) {
    return error('VALIDATION_ERROR', 'Missing variation id', 400);
  }

  const variation = await prisma.characterVariation.findUnique({
    where: { id: variationId },
    select: {
      id: true,
      imagePath: true,
      character: {
        select: { isCatalogPublic: true },
      },
      imageVariants: {
        where: {
          kind: CHARACTER_CATALOG_PREVIEW_IMAGE_KIND,
          height,
          status: 'ready',
        },
        take: 1,
        select: { path: true, url: true },
      },
    },
  });

  if (!variation || !variation.character.isCatalogPublic || !variation.imagePath) {
    return notFound('Character image not found');
  }

  const existing = variation.imageVariants[0] ?? null;
  const existingUrl = normalizeMediaUrl(existing?.path ?? existing?.url ?? null);
  if (existingUrl) {
    return redirectToMedia(req, existingUrl);
  }

  const stored = await prepareCharacterPreviewImageVariantInStorage({
    sourcePath: variation.imagePath,
    height,
  });

  const variant = await prisma.characterImageVariant.upsert({
    where: {
      characterVariationId_kind_height: {
        characterVariationId: variation.id,
        kind: CHARACTER_CATALOG_PREVIEW_IMAGE_KIND,
        height,
      },
    },
    create: {
      characterVariationId: variation.id,
      kind: CHARACTER_CATALOG_PREVIEW_IMAGE_KIND,
      height,
      width: stored.width,
      path: stored.path,
      url: stored.url,
      status: 'ready',
    },
    update: {
      width: stored.width,
      path: stored.path,
      url: stored.url,
      status: 'ready',
    },
    select: { path: true, url: true },
  });

  const finalUrl = normalizeMediaUrl(variant.path ?? variant.url) ?? stored.url;
  return redirectToMedia(req, finalUrl);
}, 'Failed to prepare character preview image');
