import { ProjectStatus } from '@/shared/constants/status';
import type { ProjectExperience } from '@/shared/constants/project-experience';
import {
  downstreamStatusesForExperience,
  normalizeForPipelineOrdering,
  STORY_PIPELINE_ORDER,
} from '@/shared/pipeline/project-pipeline';

export const PIPELINE_ORDER: ProjectStatus[] = STORY_PIPELINE_ORDER;

export function normalizeForOrdering(
  status: ProjectStatus,
  projectExperience?: ProjectExperience | null,
): ProjectStatus | null {
  return normalizeForPipelineOrdering(status, projectExperience);
}

export function downstreamStatuses(
  status: ProjectStatus,
  projectExperience?: ProjectExperience | null,
): ProjectStatus[] {
  return downstreamStatusesForExperience(status, projectExperience);
}
