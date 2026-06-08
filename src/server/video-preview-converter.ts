import { spawn, execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

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

export type VideoPreviewConvertOptions = {
  sourcePath: string;
  targetPath: string;
  maxWidth?: number;
  maxHeight?: number;
  maxFps?: number;
  crf?: number;
  preset?: string;
  audioBitrate?: string;
  noAudio?: boolean;
};

export type VideoPreviewConvertResult = {
  targetPath: string;
  width: number | null;
  height: number | null;
  hasAudio: boolean;
  bytes: number;
};

export const VIDEO_PREVIEW_DEFAULTS = {
  maxWidth: 720,
  maxHeight: 720,
  maxFps: 30,
  crf: 24,
  preset: 'slow',
  audioBitrate: '128k',
  noAudio: false,
} as const;

export class VideoPreviewConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VideoPreviewConversionError';
  }
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

function formatFps(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
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

function hasAudio(probe: ProbeResult) {
  return Boolean(probe.streams?.some((stream) => stream.codec_type === 'audio'));
}

function resolveOutputFps(probe: ProbeResult, maxFps: number) {
  const video = probe.streams?.find((stream) => stream.codec_type === 'video');
  const sourceFps = parseFrameRate(video?.r_frame_rate);
  if (!sourceFps) return maxFps;
  return Math.min(sourceFps, maxFps);
}

function buildVideoFilter(input: Required<VideoPreviewConvertOptions>, outputFps: number) {
  const scale = [
    `scale=w='min(${input.maxWidth},iw)':h='min(${input.maxHeight},ih)'`,
    'force_original_aspect_ratio=decrease',
    'force_divisible_by=2',
    'flags=lanczos',
  ].join(':');
  return `${scale},fps=${formatFps(outputFps)},format=yuv420p`;
}

function buildFfmpegArgs(input: Required<VideoPreviewConvertOptions>, probe: ProbeResult) {
  const outputFps = resolveOutputFps(probe, input.maxFps);
  const args = [
    '-y',
    '-i',
    input.sourcePath,
    '-map',
    '0:v:0',
  ];

  if (!input.noAudio && hasAudio(probe)) {
    args.push('-map', '0:a:0');
  }

  args.push(
    '-vf',
    buildVideoFilter(input, outputFps),
    '-c:v',
    'libx264',
    '-profile:v',
    'high',
    '-level:v',
    '4.0',
    '-preset',
    input.preset,
    '-crf',
    String(input.crf),
    '-pix_fmt',
    'yuv420p',
  );

  if (input.noAudio || !hasAudio(probe)) {
    args.push('-an');
  } else {
    args.push('-c:a', 'aac', '-b:a', input.audioBitrate, '-ac', '2');
  }

  args.push('-movflags', '+faststart', input.targetPath);
  return args;
}

function runCommand(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 10000) {
        stderr = stderr.slice(-10000);
      }
    });

    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${command} exited with code ${code}${stderr ? `: ${stderr}` : ''}`));
      } else {
        resolve();
      }
    });
  });
}

export async function convertVideoPreviewAtPath(options: VideoPreviewConvertOptions): Promise<VideoPreviewConvertResult> {
  const input: Required<VideoPreviewConvertOptions> = {
    sourcePath: options.sourcePath,
    targetPath: options.targetPath,
    maxWidth: options.maxWidth ?? VIDEO_PREVIEW_DEFAULTS.maxWidth,
    maxHeight: options.maxHeight ?? VIDEO_PREVIEW_DEFAULTS.maxHeight,
    maxFps: options.maxFps ?? VIDEO_PREVIEW_DEFAULTS.maxFps,
    crf: options.crf ?? VIDEO_PREVIEW_DEFAULTS.crf,
    preset: options.preset ?? VIDEO_PREVIEW_DEFAULTS.preset,
    audioBitrate: options.audioBitrate ?? VIDEO_PREVIEW_DEFAULTS.audioBitrate,
    noAudio: options.noAudio ?? VIDEO_PREVIEW_DEFAULTS.noAudio,
  };

  await fs.mkdir(path.dirname(input.targetPath), { recursive: true });

  const inputProbe = await probeVideo(input.sourcePath);
  const inputVideo = inputProbe.streams?.find((stream) => stream.codec_type === 'video');
  if (!inputVideo) {
    throw new VideoPreviewConversionError(`No video stream found in ${input.sourcePath}`);
  }

  try {
    await runCommand('ffmpeg', buildFfmpegArgs(input, inputProbe));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new VideoPreviewConversionError(`Video preview conversion failed: ${message}`);
  }

  const outputProbe = await probeVideo(input.targetPath).catch(() => null);
  const outputVideo = outputProbe?.streams?.find((stream) => stream.codec_type === 'video');
  const outputStats = await fs.stat(input.targetPath);

  return {
    targetPath: input.targetPath,
    width: outputVideo?.width ?? null,
    height: outputVideo?.height ?? null,
    hasAudio: hasAudio(outputProbe ?? {}),
    bytes: outputStats.size,
  };
}

type ConvertUploadedVideoPreviewOptions = {
  sourceFile: File;
  sourceExtension: string;
  noAudio?: boolean;
};

export async function convertUploadedVideoPreview(options: ConvertUploadedVideoPreviewOptions): Promise<File> {
  const ext = options.sourceExtension.trim().toLowerCase().replace(/^\./, '') || 'mp4';
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'admin-character-preview-'));
  const sourcePath = path.join(tempDir, `source.${ext}`);
  const targetPath = path.join(tempDir, 'preview.mp4');

  try {
    const sourceBuffer = Buffer.from(await options.sourceFile.arrayBuffer());
    await fs.writeFile(sourcePath, sourceBuffer);
    await convertVideoPreviewAtPath({
      sourcePath,
      targetPath,
      noAudio: options.noAudio ?? false,
    });
    const outputBuffer = await fs.readFile(targetPath);
    return new File([outputBuffer], 'preview.mp4', { type: 'video/mp4' });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
