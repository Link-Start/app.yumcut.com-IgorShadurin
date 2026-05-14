"use client";

import { StoryProjectScreen } from '@/components/project/story/StoryProjectScreen';

export function ProjectScreen({ projectId }: { projectId: string }) {
  return <StoryProjectScreen projectId={projectId} />;
}
