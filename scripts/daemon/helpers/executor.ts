import { ProjectStatus } from '@/shared/constants/status';
import { getCreationSnapshot, isProjectUnavailableError, setStatus } from './db';
import { log } from './logger';
import { getDaemonConfig } from './executor/context';
import { handleScriptPhase } from './executor/script-phase';
import { handleAudioPhase } from './executor/audio-phase';
import { handleTranscriptionPhase } from './executor/transcription-phase';
import { handleMetadataPhase } from './executor/metadata-phase';
import { handleCaptionsPhase } from './executor/captions-phase';
import { handleImagesPhase } from './executor/images-phase';
import { handleVideoPartsPhase } from './executor/video-parts-phase';
import { handleVideoMainPhase } from './executor/video-main-phase';
import { handleRiggerAnimationPhase } from './executor/rigger-animation-phase';
import { createHandledError, getHandledJobResult, isHandledError } from './executor/error';
import { isStatusAllowedForExperience } from '@/shared/pipeline/project-pipeline';
import { buildStatusErrorExtra } from './status-error-extra';

export { __setDaemonConfigForTests } from './executor/context';

export async function executeForProject(projectId: string, status: ProjectStatus, jobPayload?: Record<string, unknown> | null): Promise<void> {
  const cfg = await getCreationSnapshot(projectId);
  const creationGuidance = cfg.scriptCreationGuidanceEnabled ? (cfg.scriptCreationGuidance || '').trim() : '';
  const avoidanceGuidance = cfg.scriptAvoidanceGuidanceEnabled ? (cfg.scriptAvoidanceGuidance || '').trim() : '';
  const daemonConfig = getDaemonConfig();

  if (!isStatusAllowedForExperience(status, cfg.projectExperience)) {
    log.warn('Skipping status that is not available for project experience', {
      projectId,
      status,
      projectExperience: cfg.projectExperience,
    });
    return;
  }

  if (creationGuidance || avoidanceGuidance) {
    log.info('Using script guidance', {
      projectId,
      creationGuidancePreview: creationGuidance ? creationGuidance.slice(0, 120) : null,
      avoidanceGuidancePreview: avoidanceGuidance ? avoidanceGuidance.slice(0, 120) : null,
    });
  }

  try {
    switch (status) {
      case ProjectStatus.ProcessScript: {
        await handleScriptPhase({
          projectId,
          cfg,
          jobPayload: jobPayload ?? {},
          creationGuidance,
          avoidanceGuidance,
        });
        return;
      }
      case ProjectStatus.ProcessAudio: {
        await handleAudioPhase({
          projectId,
          cfg,
          jobPayload: jobPayload ?? {},
        });
        return;
      }
      case ProjectStatus.ProcessTranscription: {
        await handleTranscriptionPhase({
          projectId,
          jobPayload: jobPayload ?? {},
          cfg,
          daemonConfig,
        });
        return;
      }
      case ProjectStatus.ProcessMetadata: {
        await handleMetadataPhase({
          projectId,
          cfg,
          daemonConfig,
        });
        return;
      }
      case ProjectStatus.ProcessCaptionsVideo: {
        await handleCaptionsPhase({
          projectId,
          cfg,
          daemonConfig,
        });
        return;
      }
      case ProjectStatus.ProcessImagesGeneration: {
        await handleImagesPhase({
          projectId,
          cfg,
          jobPayload: jobPayload ?? {},
          daemonConfig,
        });
        return;
      }
      case ProjectStatus.ProcessVideoPartsGeneration: {
        await handleVideoPartsPhase({
          projectId,
          cfg,
          jobPayload: jobPayload ?? {},
          daemonConfig,
        });
        return;
      }
      case ProjectStatus.ProcessVideoMain: {
        if (cfg.projectExperience === 'rigger-animation') {
          await handleRiggerAnimationPhase({
            projectId,
            cfg,
            jobPayload: jobPayload ?? {},
            daemonConfig,
          });
          return;
        }
        await handleVideoMainPhase({
          projectId,
          cfg,
          jobPayload: jobPayload ?? {},
          daemonConfig,
        });
        return;
      }
      default:
        return;
    }
  } catch (err: any) {
    if (isProjectUnavailableError(err)) {
      log.info('Project unavailable during execution; stopping task gracefully', {
        projectId,
        status,
      });
      throw createHandledError('Project unavailable', err, { jobResult: 'success' });
    }
    if (!isHandledError(err)) {
      log.error('Executor crashed', { projectId, status, error: err?.message || String(err) });
      await setStatus(projectId, ProjectStatus.Error, 'Executor crashed', buildStatusErrorExtra('executor', err, {
        status,
      }));
    }
    throw err;
  }
}

export async function executeJob(job: { id: string; projectId: string; type: string; payload: Record<string, unknown> | null }): Promise<boolean> {
  const { projectId, type, payload } = job;
  let status: ProjectStatus;
  switch (type) {
    case 'script':
      status = ProjectStatus.ProcessScript;
      break;
    case 'audio':
      status = ProjectStatus.ProcessAudio;
      break;
    case 'transcription':
      status = ProjectStatus.ProcessTranscription;
      break;
    case 'metadata':
      status = ProjectStatus.ProcessMetadata;
      break;
    case 'captions_video':
      status = ProjectStatus.ProcessCaptionsVideo;
      break;
    case 'images':
      status = ProjectStatus.ProcessImagesGeneration;
      break;
    case 'video_parts':
      status = ProjectStatus.ProcessVideoPartsGeneration;
      break;
    case 'video_main':
      status = ProjectStatus.ProcessVideoMain;
      break;
    case 'rigger_animation':
      status = ProjectStatus.ProcessVideoMain;
      break;
    default:
      log.warn('Unknown job type; skipping', { type });
      return true;
  }
  try {
    await executeForProject(projectId, status, payload);
    return true;
  } catch (err) {
    if (isHandledError(err)) {
      return getHandledJobResult(err) === 'success';
    }
    return false;
  }
}
