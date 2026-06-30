"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export type ImagePreviewDialogImage = {
  url: string;
  label: string;
};

type ImagePreviewDialogProps = {
  image: ImagePreviewDialogImage | null;
  openLabel: string;
  onOpenChange: (open: boolean) => void;
};

export function ImagePreviewDialog({ image, openLabel, onOpenChange }: ImagePreviewDialogProps) {
  const label = image?.label ?? openLabel;

  return (
    <Dialog open={!!image} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-1/2 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-6xl -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white p-3 shadow-2xl dark:border-gray-800 dark:bg-gray-950"
        ariaDescription={label}
      >
        <DialogHeader className="mb-2 pr-8">
          <DialogTitle className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
            {label}
          </DialogTitle>
        </DialogHeader>
        {image ? (
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-lg bg-gray-50 dark:bg-gray-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.url}
              alt={image.label}
              className="max-h-[calc(100dvh-6.5rem)] max-w-full object-contain"
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
