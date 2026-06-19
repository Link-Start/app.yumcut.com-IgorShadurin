import { describe, expect, it } from 'vitest';
import { ProjectStatus } from '@/shared/constants/status';
import {
  downstreamStatusesForExperience,
  jobTypeForProjectStatus,
  legalStatusTypePairsForExperience,
  pipelineOrderForExperience,
  statusOptionsForExperience,
} from '@/shared/pipeline/project-pipeline';

describe('project pipeline by experience', () => {
  it('keeps image generation in the story pipeline', () => {
    expect(pipelineOrderForExperience('story')).toEqual([
      ProjectStatus.ProcessScript,
      ProjectStatus.ProcessAudio,
      ProjectStatus.ProcessTranscription,
      ProjectStatus.ProcessMetadata,
      ProjectStatus.ProcessCaptionsVideo,
      ProjectStatus.ProcessImagesGeneration,
      ProjectStatus.ProcessVideoPartsGeneration,
      ProjectStatus.ProcessVideoMain,
    ]);
    expect(jobTypeForProjectStatus(ProjectStatus.ProcessImagesGeneration, 'story')).toBe('images');
    expect(legalStatusTypePairsForExperience('story')).toContainEqual({
      status: ProjectStatus.ProcessImagesGeneration,
      type: 'images',
    });
  });

  it('skips image generation in the character pipeline', () => {
    expect(pipelineOrderForExperience('character')).toEqual([
      ProjectStatus.ProcessScript,
      ProjectStatus.ProcessAudio,
      ProjectStatus.ProcessTranscription,
      ProjectStatus.ProcessMetadata,
      ProjectStatus.ProcessCaptionsVideo,
      ProjectStatus.ProcessVideoPartsGeneration,
      ProjectStatus.ProcessVideoMain,
    ]);
    expect(jobTypeForProjectStatus(ProjectStatus.ProcessImagesGeneration, 'character')).toBeNull();
    expect(legalStatusTypePairsForExperience('character')).not.toContainEqual({
      status: ProjectStatus.ProcessImagesGeneration,
      type: 'images',
    });
  });

  it('uses only image generation for standalone image projects', () => {
    expect(pipelineOrderForExperience('image-generation')).toEqual([
      ProjectStatus.ProcessImagesGeneration,
    ]);
    expect(jobTypeForProjectStatus(ProjectStatus.New, 'image-generation')).toBeNull();
    expect(jobTypeForProjectStatus(ProjectStatus.ProcessImagesGeneration, 'image-generation')).toBe('images');
    expect(legalStatusTypePairsForExperience('image-generation')).toEqual([
      { status: ProjectStatus.ProcessImagesGeneration, type: 'images' },
    ]);
  });

  it('resets downstream character stages without targeting images', () => {
    expect(downstreamStatusesForExperience(ProjectStatus.New, 'character')).not.toContain(
      ProjectStatus.ProcessImagesGeneration,
    );
    expect(downstreamStatusesForExperience(ProjectStatus.ProcessCaptionsVideo, 'character')).toEqual([
      ProjectStatus.ProcessVideoPartsGeneration,
      ProjectStatus.ProcessVideoMain,
    ]);
  });

  it('hides image status from character admin options', () => {
    expect(statusOptionsForExperience('character')).not.toContain(ProjectStatus.ProcessImagesGeneration);
    expect(statusOptionsForExperience('story')).toContain(ProjectStatus.ProcessImagesGeneration);
  });
});
