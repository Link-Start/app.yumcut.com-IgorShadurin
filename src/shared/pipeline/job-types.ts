import { ProjectStatus } from '@/shared/constants/status';
import type { ProjectExperience } from '@/shared/constants/project-experience';
import {
  jobTypeForProjectStatus,
  legalStatusTypePairsForAllExperiences,
  legalStatusTypePairsForExperience,
} from '@/shared/pipeline/project-pipeline';

// Single source of truth for mapping project status -> daemon job type.
export function jobTypeForStatus(status: ProjectStatus, projectExperience?: ProjectExperience | null): string | null {
  return jobTypeForProjectStatus(status, projectExperience);
}

export function legalStatusTypePairs(projectExperience?: ProjectExperience | null): { status: ProjectStatus; type: string }[] {
  return projectExperience
    ? legalStatusTypePairsForExperience(projectExperience)
    : legalStatusTypePairsForAllExperiences();
}
