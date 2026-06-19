import path from 'path';
import { promises as fs } from 'fs';
import { ProjectStatus } from '@/shared/constants/status';
import { QWEN_DEFAULT_NEGATIVE_PROMPT, requestRunwareImage } from '@/server/image-generation/runware';
import { config } from '@/server/config';
import type { DaemonConfig } from '../config';
import { addImageAsset, setStatus } from '../db';
import { log } from '../logger';
import { buildStatusErrorExtra } from '../status-error-extra';
import { createHandledError } from './error';

type ImageGenerationProjectPhaseArgs = {
  projectId: string;
  jobPayload: Record<string, unknown>;
  daemonConfig: DaemonConfig;
};

function numberFromPayload(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : fallback;
}

function stringFromPayload(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : fallback;
}

export async function handleImageGenerationProjectPhase({
  projectId,
  jobPayload,
  daemonConfig,
}: ImageGenerationProjectPhaseArgs) {
  const prompt = stringFromPayload(jobPayload.prompt, '');
  if (!prompt) {
    throw new Error('Image generation prompt is required');
  }

  const apiKey = (config.RUNWARE_IMAGE_EDITOR_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('Runware API key is not configured');
  }

  const provider = 'runware';
  const model = stringFromPayload(jobPayload.model, 'runware:108@1');
  const width = numberFromPayload(jobPayload.width, 1024);
  const height = numberFromPayload(jobPayload.height, 1024);
  const outputFormat = 'jpg';
  const workspace = path.join(daemonConfig.projectsWorkspace, projectId, 'image-generation');

  try {
    await fs.mkdir(workspace, { recursive: true });
    const result = await requestRunwareImage({
      apiKey,
      prompt,
      width,
      height,
      model,
      negativePrompt: QWEN_DEFAULT_NEGATIVE_PROMPT,
    });
    const outputPath = path.join(workspace, `result.${outputFormat}`);
    await fs.writeFile(outputPath, Buffer.from(result.imageBytes));
    const asset = await addImageAsset(projectId, outputPath);

    await setStatus(projectId, ProjectStatus.Done, 'Image ready', {
      projectExperience: 'image-generation',
      finalImageUrl: asset.url,
      finalImagePath: asset.path,
      finalImageAssetId: asset.id,
      resultFormat: outputFormat,
      provider,
      model,
      width,
      height,
      prompt,
      imageGenerationWorkspace: workspace,
      runwareResponse: result.responseJson,
    });

    log.info('Standalone image generation completed', {
      projectId,
      path: asset.path,
      url: asset.url,
      width,
      height,
      model,
    });
  } catch (err: any) {
    log.error('Standalone image generation failed', {
      projectId,
      error: err?.message || String(err),
    });
    await setStatus(projectId, ProjectStatus.Error, 'Image generation failed', buildStatusErrorExtra('image-generation', err, {
      workspace,
      model,
      width,
      height,
    }));
    throw createHandledError('Image generation failed', err);
  }
}
