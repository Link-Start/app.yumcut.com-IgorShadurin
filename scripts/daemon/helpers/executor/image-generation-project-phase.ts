import path from 'path';
import { promises as fs } from 'fs';
import { ProjectStatus } from '@/shared/constants/status';
import { QWEN_DEFAULT_NEGATIVE_PROMPT } from '@/server/image-generation/runware';
import {
  DEFAULT_IMAGE_GENERATION_HEIGHT,
  DEFAULT_IMAGE_GENERATION_WIDTH,
} from '@/shared/constants/image-generation';
import type { DaemonConfig } from '../config';
import { addImageAsset, setStatus } from '../db';
import { runImageGenerationTool } from '../image-generation';
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

function imagePrankSourceUrls(value: unknown): string[] {
  const sourceImages = Array.isArray((value as any)?.sourceImages)
    ? (value as any).sourceImages
    : [];
  return sourceImages
    .map((entry: any) => typeof entry?.imageUrl === 'string' ? entry.imageUrl.trim() : '')
    .filter((url: string) => url.length > 0);
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

  const provider = 'runware';
  const model = stringFromPayload(jobPayload.model, 'runware:108@1');
  const width = numberFromPayload(jobPayload.width, DEFAULT_IMAGE_GENERATION_WIDTH);
  const height = numberFromPayload(jobPayload.height, DEFAULT_IMAGE_GENERATION_HEIGHT);
  const imageKind = stringFromPayload(jobPayload.imageKind, 'standalone');
  const imagePrank = (jobPayload.imagePrank && typeof jobPayload.imagePrank === 'object')
    ? jobPayload.imagePrank as Record<string, unknown>
    : null;
  const outputFormat = 'jpg';
  const workspace = path.join(daemonConfig.projectsWorkspace, projectId, 'image-generation');

  try {
    await fs.mkdir(workspace, { recursive: true });
    const toolResult = await runImageGenerationTool({
      projectId,
      toolsWorkspace: daemonConfig.scriptWorkspaceV2,
      projectWorkspace: workspace,
      prompt,
      width,
      height,
      model,
      outputFormat,
      negativePrompt: QWEN_DEFAULT_NEGATIVE_PROMPT,
      referenceImages: imageKind === 'image-prank' && imagePrank ? imagePrankSourceUrls(imagePrank) : [],
    });
    const asset = await addImageAsset(projectId, toolResult.outputPath);

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
      userPrompt: stringFromPayload(jobPayload.userPrompt, prompt),
      ...(imageKind === 'image-prank' && imagePrank
        ? {
            imageKind,
            imagePrank,
          }
        : {}),
      imageGenerationWorkspace: workspace,
      runwareResponse: toolResult.responseJson,
    });

    log.info('Standalone image generation completed', {
      projectId,
      path: asset.path,
      url: asset.url,
      width,
      height,
      model,
      command: toolResult.command,
      logPath: toolResult.logPath,
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
      toolsWorkspace: daemonConfig.scriptWorkspaceV2,
      imageKind,
      ...(imagePrank ? { imagePrank } : {}),
    }));
    throw createHandledError('Image generation failed', err);
  }
}
