#!/usr/bin/env tsx
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const COMPOSITION_ID = 'WelcomeImagePrankPromo';
const DEFAULT_OUTPUT = '/Users/test/Downloads/yumcut-video-prank/yumcut-image-prank-welcome.mp4';
const DEFAULT_IOS_OUTPUT = '/Users/test/Downloads/yumcut-video-prank/yumcut-image-prank-welcome-ios.mp4';
const REQUIRED_RESOURCES = [
  'semi-open-door.jpg',
  'homeless-source.jpg',
  'door-homeless.jpg',
  'bed.jpg',
  'woman-source.jpg',
  'bed-prank.jpg',
] as const;

type CliOptions = {
  output: string;
  iosOutput: string;
  skipIos: boolean;
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const entryPoint = path.join(scriptDir, 'Root.tsx');
const resourcesDir = path.join(scriptDir, 'resources');

function printUsage(message?: string): never {
  if (message) {
    console.error(`Error: ${message}`);
  }
  console.log(`\nUsage: npm run welcome:prank-video -- [--output <output.mp4>] [--ios-output <ios-output.mp4>] [--skip-ios]\n\nDefault output:\n  ${DEFAULT_OUTPUT}\nDefault iOS output:\n  ${DEFAULT_IOS_OUTPUT}\n`);
  process.exit(message ? 1 : 0);
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = { output: DEFAULT_OUTPUT, iosOutput: DEFAULT_IOS_OUTPUT, skipIos: false };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      printUsage();
    }
    if (!arg.startsWith('--')) {
      printUsage(`Unexpected argument: ${arg}`);
    }

    const key = arg.slice(2);
    if (key === 'skip-ios') {
      options.skipIos = true;
      continue;
    }

    const next = args[i + 1];
    if (!next || next.startsWith('--')) {
      printUsage(`Missing value for --${key}`);
    }
    i += 1;

    switch (key) {
      case 'output':
        options.output = next;
        break;
      case 'ios-output':
        options.iosOutput = next;
        break;
      default:
        printUsage(`Unknown option: --${key}`);
    }
  }

  return options;
}

async function assertResourcesExist() {
  const missing: string[] = [];
  for (const resource of REQUIRED_RESOURCES) {
    try {
      await fs.access(path.join(resourcesDir, resource));
    } catch {
      missing.push(resource);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing Remotion resources: ${missing.join(', ')}`);
  }
}

async function ensureParentDir(filePath: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

function formatProgress(progress: number) {
  const percent = progress > 1 ? progress : progress * 100;
  return `${Math.round(percent).toString().padStart(3, ' ')}%`;
}

async function runCommand(command: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} failed with code ${code}`));
    });
  });
}

async function convertForIos(input: string, output: string) {
  await ensureParentDir(output);
  await runCommand('ffmpeg', [
    '-y',
    '-hide_banner',
    '-loglevel',
    'warning',
    '-i',
    input,
    '-vf',
    'scale=496:864:force_original_aspect_ratio=increase,crop=496:864,fps=24',
    '-an',
    '-c:v',
    'libx264',
    '-profile:v',
    'baseline',
    '-level',
    '3.1',
    '-pix_fmt',
    'yuv420p',
    '-b:v',
    '1500k',
    '-maxrate',
    '1800k',
    '-bufsize',
    '3000k',
    '-movflags',
    '+faststart',
    output,
  ]);
}

async function main() {
  const options = parseArgs();
  const outputLocation = path.resolve(options.output);
  const iosOutputLocation = path.resolve(options.iosOutput);

  await assertResourcesExist();
  await ensureParentDir(outputLocation);

  console.log('> Bundling Remotion composition');
  const serveUrl = await bundle({
    entryPoint,
    publicDir: resourcesDir,
    onProgress: (progress) => {
      process.stdout.write(`\r  bundle ${formatProgress(progress)}`);
    },
  });
  process.stdout.write('\n');

  console.log('> Selecting composition');
  const composition = await selectComposition({
    serveUrl,
    id: COMPOSITION_ID,
    inputProps: {},
  });

  console.log('> Rendering welcome promo video');
  await renderMedia({
    serveUrl,
    composition,
    inputProps: {},
    codec: 'h264',
    outputLocation,
    overwrite: true,
    crf: 18,
    pixelFormat: 'yuv420p',
    imageFormat: 'png',
    muted: true,
    onProgress: ({ progress }) => {
      process.stdout.write(`\r  render ${formatProgress(progress)}`);
    },
  });
  process.stdout.write('\n');

  console.log('Video rendered:', outputLocation);
  if (!options.skipIos) {
    console.log('> Converting welcome promo for iOS');
    await convertForIos(outputLocation, iosOutputLocation);
    console.log('iOS video rendered:', iosOutputLocation);
  }
}

main().catch((err) => {
  console.error('Welcome prank video render failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
