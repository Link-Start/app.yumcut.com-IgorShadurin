import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ImagePrankComposer } from '@/components/image-prank/ImagePrankComposer';
import { getPublicImagePrankItemBySlug } from '@/server/image-pranks';

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const item = await getPublicImagePrankItemBySlug(slug);
  if (!item) return {};
  return {
    title: `${item.title.en || item.title.ru} | Image Prank | YumCut`,
  };
}

export default async function ImagePrankItemPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const item = await getPublicImagePrankItemBySlug(slug);
  if (!item) notFound();
  return (
    <Suspense fallback={null}>
      <ImagePrankComposer item={item} />
    </Suspense>
  );
}
