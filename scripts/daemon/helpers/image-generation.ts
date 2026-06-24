import path from 'path';
import { promises as fs } from 'fs';
import { runNpmCommand } from './video/run-npm-command';
import { assertFileExists } from './video/assert-file-exists';

type RunImageGenerationToolOptions = {
  projectId: string;
  toolsWorkspace: string;
  projectWorkspace: string;
  prompt: string;
  width: number;
  height: number;
  model: string;
  outputFormat: 'jpg' | 'png' | 'webp';
  negativePrompt?: string;
  referenceImages?: string[];
};

type RunImageGenerationToolResult = {
  logPath: string;
  command: string;
  outputPath: string;
  responseJson: any | null;
};

function sanitizeValue(value: string): string {
  return value.trim();
}

async function readResponseJson(filePath: string): Promise<any | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function runImageGenerationTool(options: RunImageGenerationToolOptions): Promise<RunImageGenerationToolResult> {
  const outputPath = path.join(options.projectWorkspace, `result.${options.outputFormat}`);
  const responseJsonPath = path.join(options.projectWorkspace, 'response.json');
  const logDir = path.join(options.projectWorkspace, 'logs');

  await fs.mkdir(options.projectWorkspace, { recursive: true });
  await fs.mkdir(logDir, { recursive: true });

  const args = [
    'run',
    '-s',
    'image:prank',
    '--',
    '--prompt',
    options.prompt,
    '--output',
    outputPath,
    '--width',
    String(options.width),
    '--height',
    String(options.height),
    '--model',
    options.model,
    '--format',
    options.outputFormat,
    '--response-json',
    responseJsonPath,
  ];

  const negativePrompt = options.negativePrompt ? sanitizeValue(options.negativePrompt) : '';
  if (negativePrompt) {
    args.push('--negative-prompt', negativePrompt);
  }

  for (const referenceImage of options.referenceImages ?? []) {
    const value = sanitizeValue(referenceImage);
    if (!value) continue;
    args.push('--reference-image', value);
  }

  const run = await runNpmCommand({
    projectId: options.projectId,
    cwd: options.toolsWorkspace,
    workspaceRoot: options.toolsWorkspace,
    args,
    logDir,
    logName: 'image-prank',
  });

  await assertFileExists(outputPath, 'generated image');
  return {
    logPath: run.logPath,
    command: run.displayCommand,
    outputPath,
    responseJson: await readResponseJson(responseJsonPath),
  };
}
