import type { Metadata } from 'next';
import { ImagePrankComposer } from '@/components/image-prank/ImagePrankComposer';

export const metadata: Metadata = {
  title: 'Custom Image Prank | YumCut',
};

export default function CustomImagePrankPage() {
  return <ImagePrankComposer />;
}
