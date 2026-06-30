import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ImagePrankComposer } from '@/components/image-prank/ImagePrankComposer';

export const metadata: Metadata = {
  title: 'Custom Image Prank | YumCut',
};

export default function CustomImagePrankPage() {
  return (
    <Suspense fallback={null}>
      <ImagePrankComposer />
    </Suspense>
  );
}
