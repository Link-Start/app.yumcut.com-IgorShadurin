#!/usr/bin/env tsx
import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

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

type ProbeStream = {
  codec_type?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
};

type ProbeResult = {
  streams?: ProbeStream[];
  format?: {
    duration?: string;
    size?: string;
  };
};

const DEFAULTS: CliOptions = {
  maxWidth: 720,
  maxHeight: 720,
  maxFps: 30,
  crf: 24,
  preset: 'slow',
  audioBitrate: '128k',
  noAudio: false,
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

  const merged = { ...DEFAULTS, ...options } as CliOptions;
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

async function ensureParentDir(filePath: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

function defaultTargetFor(sourcePath: string) {
  const parsed = path.parse(sourcePath);
  return path.join(parsed.dir, `${parsed.name}.preview.mp4`);
}

function runCommand(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${command} exited with code ${code}`));
      } else {
        resolve();
      }
    });
  });
}

async function probeVideo(filePath: string): Promise<ProbeResult> {
  const result = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'stream=codec_type,width,height,r_frame_rate',
    '-show_entries',
    'format=duration,size',
    '-of',
    'json',
    filePath,
  ]);
  return JSON.parse(result.stdout || '{}') as ProbeResult;
}

function parseFrameRate(value?: string) {
  if (!value) return null;
  const [numeratorRaw, denominatorRaw] = value.split('/');
  const numerator = Number(numeratorRaw);
  const denominator = Number(denominatorRaw || '1');
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  const fps = numerator / denominator;
  return Number.isFinite(fps) && fps > 0 ? fps : null;
}

function resolveOutputFps(probe: ProbeResult, maxFps: number) {
  const video = probe.streams?.find((stream) => stream.codec_type === 'video');
  const sourceFps = parseFrameRate(video?.r_frame_rate);
  if (!sourceFps) return maxFps;
  return Math.min(sourceFps, maxFps);
}

function formatFps(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

function hasAudio(probe: ProbeResult) {
  return Boolean(probe.streams?.some((stream) => stream.codec_type === 'audio'));
}

function buildVideoFilter(options: CliOptions, outputFps: number) {
  const scale = [
    `scale=w='min(${options.maxWidth},iw)':h='min(${options.maxHeight},ih)'`,
    'force_original_aspect_ratio=decrease',
    'force_divisible_by=2',
    'flags=lanczos',
  ].join(':');
  return `${scale},fps=${formatFps(outputFps)},format=yuv420p`;
}

function buildFfmpegArgs(options: CliOptions, sourcePath: string, targetPath: string, probe: ProbeResult) {
  const outputFps = resolveOutputFps(probe, options.maxFps);
  const args = [
    '-y',
    '-i',
    sourcePath,
    '-map',
    '0:v:0',
  ];

  if (!options.noAudio && hasAudio(probe)) {
    args.push('-map', '0:a:0');
  }

  args.push(
    '-vf',
    buildVideoFilter(options, outputFps),
    '-c:v',
    'libx264',
    '-profile:v',
    'high',
    '-level:v',
    '4.0',
    '-preset',
    options.preset,
    '-crf',
    String(options.crf),
    '-pix_fmt',
    'yuv420p',
  );

  if (options.noAudio || !hasAudio(probe)) {
    args.push('-an');
  } else {
    args.push('-c:a', 'aac', '-b:a', options.audioBitrate, '-ac', '2');
  }

  args.push('-movflags', '+faststart', targetPath);
  return args;
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

  await ensureParentDir(targetPath);
  const probe = await probeVideo(sourcePath);
  const video = probe.streams?.find((stream) => stream.codec_type === 'video');
  if (!video) {
    printUsage(`No video stream found in ${sourcePath}`);
  }

  const args = buildFfmpegArgs(options, sourcePath, targetPath, probe);
  console.log('> Running ffmpeg to create compact MP4 video preview');
  await runCommand('ffmpeg', args);

  const outputProbe = await probeVideo(targetPath).catch(() => null);
  const outputVideo = outputProbe?.streams?.find((stream) => stream.codec_type === 'video');
  const outputStats = await fs.stat(targetPath);
  console.log('Conversion complete:', {
    target: targetPath,
    width: outputVideo?.width ?? null,
    height: outputVideo?.height ?? null,
    hasAudio: hasAudio(outputProbe ?? {}),
    bytes: outputStats.size,
  });
}

main().catch((err) => {
  console.error('Conversion failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
