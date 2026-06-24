import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';

const runNpmCommandMock = vi.fn(async ({ logDir }: any) => {
  await fs.mkdir(logDir, { recursive: true });
  const logPath = path.join(logDir, 'image-prank.log');
  await fs.writeFile(logPath, 'ok', 'utf8');
  return { logPath, displayCommand: 'npm run -s image:mix -- ...' };
});

vi.mock('../../scripts/daemon/helpers/video/run-npm-command', () => ({
  runNpmCommand: runNpmCommandMock,
}));

describe('runImageGenerationTool', () => {
  let baseDir: string;
  let toolsWorkspace: string;
  let projectWorkspace: string;
  let runImageGenerationTool: typeof import('../../scripts/daemon/helpers/image-generation').runImageGenerationTool;

  beforeEach(async () => {
    baseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'daemon-image-generation-'));
    toolsWorkspace = path.join(baseDir, 'tools');
    projectWorkspace = path.join(baseDir, 'project');
    await fs.mkdir(toolsWorkspace, { recursive: true });
    runNpmCommandMock.mockReset();
    vi.resetModules();
    ({ runImageGenerationTool } = await import('../../scripts/daemon/helpers/image-generation'));
  });

  afterEach(async () => {
    await fs.rm(baseDir, { recursive: true, force: true }).catch(() => {});
  });

  it('invokes image:mix CLI with reference images and returns parsed response JSON', async () => {
    runNpmCommandMock.mockImplementationOnce(async ({ logDir: runLogDir, args }: any) => {
      await fs.mkdir(runLogDir, { recursive: true });
      const logPath = path.join(runLogDir, 'image-prank.log');
      await fs.writeFile(logPath, 'ok', 'utf8');
      const outputPath = args[args.indexOf('--output') + 1];
      const responseJsonPath = args[args.indexOf('--response-json') + 1];
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, 'image-bytes', 'utf8');
      await fs.writeFile(responseJsonPath, JSON.stringify({ data: [{ imageURL: 'https://example.com/image.jpg' }] }), 'utf8');
      return { logPath, displayCommand: 'npm run -s image:mix -- ...' };
    });

    const result = await runImageGenerationTool({
      projectId: 'p1',
      toolsWorkspace,
      projectWorkspace,
      prompt: 'Place the first image naturally into the second image',
      width: 1024,
      height: 1536,
      model: 'runware:108@22',
      outputFormat: 'jpg',
      negativePrompt: 'text, watermark',
      referenceImages: ['https://example.com/prank.png', 'https://example.com/target.jpg'],
    });

    expect(runNpmCommandMock).toHaveBeenCalledTimes(1);
    const args: string[] = runNpmCommandMock.mock.calls[0][0].args;
    expect(args).toEqual([
      'run',
      '-s',
      'image:mix',
      '--',
      '--prompt',
      'Place the first image naturally into the second image',
      '--output',
      path.join(projectWorkspace, 'result.jpg'),
      '--width',
      '1024',
      '--height',
      '1536',
      '--model',
      'runware:108@22',
      '--format',
      'jpg',
      '--response-json',
      path.join(projectWorkspace, 'response.json'),
      '--negative-prompt',
      'text, watermark',
      '--reference-image',
      'https://example.com/prank.png',
      '--reference-image',
      'https://example.com/target.jpg',
    ]);
    expect(result.command).toBe('npm run -s image:mix -- ...');
    expect(result.responseJson).toEqual({ data: [{ imageURL: 'https://example.com/image.jpg' }] });
    await expect(fs.access(result.outputPath)).resolves.toBeUndefined();
  });

  it('supports standalone generation without reference images', async () => {
    runNpmCommandMock.mockImplementationOnce(async ({ logDir: runLogDir, args }: any) => {
      await fs.mkdir(runLogDir, { recursive: true });
      const logPath = path.join(runLogDir, 'image-prank.log');
      await fs.writeFile(logPath, 'ok', 'utf8');
      const outputPath = args[args.indexOf('--output') + 1];
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, 'image-bytes', 'utf8');
      return { logPath, displayCommand: 'npm run -s image:mix -- ...' };
    });

    const result = await runImageGenerationTool({
      projectId: 'p2',
      toolsWorkspace,
      projectWorkspace,
      prompt: 'A clean standalone image',
      width: 1024,
      height: 1024,
      model: 'runware:108@1',
      outputFormat: 'png',
    });

    const args: string[] = runNpmCommandMock.mock.calls[0][0].args;
    expect(args).not.toContain('--reference-image');
    expect(result.responseJson).toBeNull();
    await expect(fs.access(result.outputPath)).resolves.toBeUndefined();
  });
});
