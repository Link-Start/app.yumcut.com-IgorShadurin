import { ProjectStatus } from '@/shared/constants/status';
import {
  DEFAULT_PROJECT_EXPERIENCE,
  normalizeProjectExperience,
  type ProjectExperience,
} from '@/shared/constants/project-experience';

export type DaemonJobType =
  | 'script'
  | 'audio'
  | 'transcription'
  | 'metadata'
  | 'captions_video'
  | 'images'
  | 'video_parts'
  | 'video_main';

const STATUS_JOB_TYPES: Partial<Record<ProjectStatus, DaemonJobType>> = {
  [ProjectStatus.New]: 'script',
  [ProjectStatus.ProcessScript]: 'script',
  [ProjectStatus.ProcessAudio]: 'audio',
  [ProjectStatus.ProcessTranscription]: 'transcription',
  [ProjectStatus.ProcessMetadata]: 'metadata',
  [ProjectStatus.ProcessCaptionsVideo]: 'captions_video',
  [ProjectStatus.ProcessImagesGeneration]: 'images',
  [ProjectStatus.ProcessVideoPartsGeneration]: 'video_parts',
  [ProjectStatus.ProcessVideoMain]: 'video_main',
};

export const STORY_PIPELINE_ORDER: ProjectStatus[] = [
  ProjectStatus.ProcessScript,
  ProjectStatus.ProcessAudio,
  ProjectStatus.ProcessTranscription,
  ProjectStatus.ProcessMetadata,
  ProjectStatus.ProcessCaptionsVideo,
  ProjectStatus.ProcessImagesGeneration,
  ProjectStatus.ProcessVideoPartsGeneration,
  ProjectStatus.ProcessVideoMain,
];

export const CHARACTER_PIPELINE_ORDER: ProjectStatus[] = [
  ProjectStatus.ProcessScript,
  ProjectStatus.ProcessAudio,
  ProjectStatus.ProcessTranscription,
  ProjectStatus.ProcessMetadata,
  ProjectStatus.ProcessCaptionsVideo,
  ProjectStatus.ProcessVideoPartsGeneration,
  ProjectStatus.ProcessVideoMain,
];

export function pipelineOrderForExperience(projectExperience?: ProjectExperience | null): ProjectStatus[] {
  return normalizeProjectExperience(projectExperience) === 'character'
    ? CHARACTER_PIPELINE_ORDER
    : STORY_PIPELINE_ORDER;
}

export function isStatusAllowedForExperience(
  status: ProjectStatus,
  projectExperience?: ProjectExperience | null,
): boolean {
  return pipelineOrderForExperience(projectExperience).includes(normalizeForPipelineOrdering(status) ?? status)
    || [
      ProjectStatus.New,
      ProjectStatus.ProcessScriptValidate,
      ProjectStatus.ProcessAudioValidate,
      ProjectStatus.Error,
      ProjectStatus.Done,
      ProjectStatus.Cancelled,
    ].includes(status);
}

export function statusOptionsForExperience(projectExperience?: ProjectExperience | null): ProjectStatus[] {
  return (Object.values(ProjectStatus) as ProjectStatus[]).filter((status) =>
    isStatusAllowedForExperience(status, projectExperience),
  );
}

export function normalizeForPipelineOrdering(
  status: ProjectStatus,
  projectExperience?: ProjectExperience | null,
): ProjectStatus | null {
  switch (status) {
    case ProjectStatus.New:
      return ProjectStatus.ProcessScript;
    case ProjectStatus.ProcessScriptValidate:
      return ProjectStatus.ProcessScript;
    case ProjectStatus.ProcessAudioValidate:
      return ProjectStatus.ProcessAudio;
    default:
      return pipelineOrderForExperience(projectExperience).includes(status) ? status : null;
  }
}

export function jobTypeForProjectStatus(
  status: ProjectStatus,
  projectExperience?: ProjectExperience | null,
): DaemonJobType | null {
  if (!isStatusAllowedForExperience(status, projectExperience)) return null;
  return STATUS_JOB_TYPES[status] ?? null;
}

export function legalStatusTypePairsForExperience(
  projectExperience?: ProjectExperience | null,
): { status: ProjectStatus; type: DaemonJobType }[] {
  const experience = normalizeProjectExperience(projectExperience);
  return [
    { status: ProjectStatus.New, type: 'script' },
    ...pipelineOrderForExperience(experience).map((status) => ({
      status,
      type: STATUS_JOB_TYPES[status]!,
    })),
  ];
}

export function legalStatusTypePairsForAllExperiences(): { status: ProjectStatus; type: DaemonJobType }[] {
  const pairs = [
    ...legalStatusTypePairsForExperience(DEFAULT_PROJECT_EXPERIENCE),
    ...legalStatusTypePairsForExperience('character'),
  ];
  return Array.from(new Map(pairs.map((pair) => [`${pair.status}:${pair.type}`, pair])).values());
}

export function downstreamStatusesForExperience(
  status: ProjectStatus,
  projectExperience?: ProjectExperience | null,
): ProjectStatus[] {
  const order = pipelineOrderForExperience(projectExperience);
  const normalized = normalizeForPipelineOrdering(status, projectExperience);
  if (!normalized) return [];
  const currentIndex = order.indexOf(normalized);
  if (currentIndex < 0) return [];
  return order.slice(currentIndex + 1);
}

export function nextPipelineStatus(
  status: ProjectStatus,
  projectExperience?: ProjectExperience | null,
): ProjectStatus | null {
  return downstreamStatusesForExperience(status, projectExperience)[0] ?? null;
}
