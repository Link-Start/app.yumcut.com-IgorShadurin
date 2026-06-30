#!/usr/bin/env tsx
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const COMPOSITION_ID = 'WelcomeImagePrankPromo';
const DEFAULT_OUTPUT = '/Users/test/Downloads/yumcut-video-prank/yumcut-image-prank-welcome.mp4';
const REQUIRED_RESOURCES = [
  'semi-open-door.jpg',
  'door-homeless.jpg',
  'bed.jpg',
  'bed-prank.jpg',
] as const;

type CliOptions = {
  output: string;
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const entryPoint = path.join(scriptDir, 'Root.tsx');
const resourcesDir = path.join(scriptDir, 'resources');

function printUsage(message?: string): never {
  if (message) {
    console.error(`Error: ${message}`);
  }
  console.log(`\nUsage: npm run welcome:prank-video -- [--output <output.mp4>]\n\nDefault output:\n  ${DEFAULT_OUTPUT}\n`);
  process.exit(message ? 1 : 0);
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = { output: DEFAULT_OUTPUT };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      printUsage();
    }
    if (!arg.startsWith('--')) {
      printUsage(`Unexpected argument: ${arg}`);
    }

    const key = arg.slice(2);
    const next = args[i + 1];
    if (!next || next.startsWith('--')) {
      printUsage(`Missing value for --${key}`);
    }
    i += 1;

    switch (key) {
      case 'output':
        options.output = next;
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

async function main() {
  const options = parseArgs();
  const outputLocation = path.resolve(options.output);

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
}

main().catch((err) => {
  console.error('Welcome prank video render failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
