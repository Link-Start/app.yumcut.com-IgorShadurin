#!/usr/bin/env tsx
import { promises as fs } from 'fs';
import path from 'path';
import {
  VIDEO_PREVIEW_DEFAULTS,
  convertVideoPreviewAtPath,
} from '@/server/video-preview-converter';

type CliOptions = {
  source?: string;
  target?: string;
  maxWidth: number;
  maxHeight: number;
  maxFps: number;
  crf: number;
  preset: string;
  audioBitrate: string;
  noAudio: boolean;
};

function printUsage(message?: string): never {
  if (message) {
    console.error(`Error: ${message}`);
  }
  console.log(`\nUsage: npm run tools:convert-video-preview -- \\
  --source <input-video> \\
  [--target <output-preview.mp4>] \\
  [--max-width 720] [--max-height 720] [--max-fps 30] \\
  [--crf 24] [--preset slow] [--audio-bitrate 128k] [--no-audio]\n\nExample:\n  npm run tools:convert-video-preview -- \\
    --source "./source.mp4" \\
    --target "./source.preview.mp4"\n`);
  process.exit(message ? 1 : 0);
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
  }

  const options: Partial<CliOptions> = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith('--')) {
      printUsage(`Unexpected argument: ${arg}`);
    }

    const key = arg.slice(2);
    if (key === 'no-audio') {
      options.noAudio = true;
      continue;
    }

    const next = args[i + 1];
    if (!next || next.startsWith('--')) {
      printUsage(`Missing value for --${key}`);
    }
    i += 1;

    switch (key) {
      case 'source':
        options.source = next;
        break;
      case 'target':
        options.target = next;
        break;
      case 'max-width':
        options.maxWidth = Number(next);
        break;
      case 'max-height':
        options.maxHeight = Number(next);
        break;
      case 'max-fps':
        options.maxFps = Number(next);
        break;
      case 'crf':
        options.crf = Number(next);
        break;
      case 'preset':
        options.preset = next;
        break;
      case 'audio-bitrate':
        options.audioBitrate = next;
        break;
      default:
        printUsage(`Unknown option: --${key}`);
    }
  }

  const merged = {
    maxWidth: VIDEO_PREVIEW_DEFAULTS.maxWidth,
    maxHeight: VIDEO_PREVIEW_DEFAULTS.maxHeight,
    maxFps: VIDEO_PREVIEW_DEFAULTS.maxFps,
    crf: VIDEO_PREVIEW_DEFAULTS.crf,
    preset: VIDEO_PREVIEW_DEFAULTS.preset,
    audioBitrate: VIDEO_PREVIEW_DEFAULTS.audioBitrate,
    noAudio: VIDEO_PREVIEW_DEFAULTS.noAudio,
    ...options,
  } as CliOptions;

  if (!merged.source) {
    printUsage('Missing required --source option');
  }
  validatePositiveInteger(merged.maxWidth, '--max-width');
  validatePositiveInteger(merged.maxHeight, '--max-height');
  validatePositiveNumber(merged.maxFps, '--max-fps');
  validatePositiveNumber(merged.crf, '--crf');
  if (!merged.preset.trim()) {
    printUsage('--preset must not be empty');
  }
  if (!merged.audioBitrate.trim()) {
    printUsage('--audio-bitrate must not be empty');
  }

  return merged;
}

function validatePositiveInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value <= 0) {
    printUsage(`${label} must be a positive integer`);
  }
}

function validatePositiveNumber(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) {
    printUsage(`${label} must be a positive number`);
  }
}

function defaultTargetFor(sourcePath: string) {
  const parsed = path.parse(sourcePath);
  return path.join(parsed.dir, `${parsed.name}.preview.mp4`);
}

async function main() {
  const options = parseArgs();
  const sourcePath = path.resolve(options.source!);
  const targetPath = path.resolve(options.target ? options.target : defaultTargetFor(sourcePath));

  try {
    await fs.access(sourcePath);
  } catch {
    printUsage(`Source video not found at ${sourcePath}`);
  }

  console.log('> Running ffmpeg to create compact MP4 video preview');
  const result = await convertVideoPreviewAtPath({
    sourcePath,
    targetPath,
    maxWidth: options.maxWidth,
    maxHeight: options.maxHeight,
    maxFps: options.maxFps,
    crf: options.crf,
    preset: options.preset,
    audioBitrate: options.audioBitrate,
    noAudio: options.noAudio,
  });
  console.log('Conversion complete:', result);
}

main().catch((err) => {
  console.error('Conversion failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
