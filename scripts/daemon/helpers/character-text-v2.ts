import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { loadConfig } from './config';
import { formatCommandForCommandsLog, withWorkspaceCommandLog } from './commands-log';
import type { ContentTone } from '@/shared/constants/content-tone';
import { normalizeContentTone } from '@/shared/constants/content-tone';

const cfg = loadConfig();

const DEFAULT_MODEL = 'openai/gpt-oss-120b';
const DEFAULT_REASONING = 'low';
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_COOLDOWN_MS = 3000;
const DEFAULT_THREADS = 1;
const STRUCTURED_PLACEHOLDER = '{{CURRENT_TEXT_ITEM}}';
const TEMPLATE_ASSET_ROOT = path.resolve(__dirname, '../assets/character-text-v2');
const TEMPLATE_FILE_PATHS = {
  generate: path.join(TEMPLATE_ASSET_ROOT, 'generate-template.md'),
  refine: path.join(TEMPLATE_ASSET_ROOT, 'refine-template.md'),
  toneNeutral: path.join(TEMPLATE_ASSET_ROOT, 'tone-neutral.md'),
  tonePlayful: path.join(TEMPLATE_ASSET_ROOT, 'tone-playful.md'),
  toneAngry: path.join(TEMPLATE_ASSET_ROOT, 'tone-angry.md'),
} as const;
const TEMPLATE_PLACEHOLDERS = {
  languageLine: '{{LANGUAGE_LINE}}',
  toneInstruction: '{{TONE_INSTRUCTION}}',
  targetWords: '{{TARGET_WORDS}}',
  currentTextItem: '{{CURRENT_TEXT_ITEM}}',
} as const;

type BaseOptions = {
  durationSeconds?: number | null;
  workspaceRoot?: string | null;
  tone?: ContentTone | null;
  language?: string | null;
};

export type CharacterTextV2Result = {
  text: string;
  command: string;
  args: string[];
};

type GenerateOptions = BaseOptions & {
  prompt: string;
};

type RefineOptions = BaseOptions & {
  script: string;
  instructions: string;
};

type CharacterTextTemplates = {
  generateTemplate: string;
  refineTemplate: string;
  toneInstructions: Record<ContentTone, string>;
};

let cachedCharacterTextTemplates: CharacterTextTemplates | null = null;
let characterTextTemplatesPromise: Promise<CharacterTextTemplates> | null = null;

export class CharacterTextV2Error extends Error {
  command: string;

  constructor(message: string, command: string) {
    super(message);
    this.name = 'CharacterTextV2Error';
    this.command = command;
  }
}

function quoteArg(value: string) {
  if (/^[\w@./:+-]+$/u.test(value)) return value;
  return JSON.stringify(value);
}

function sanitizeOutput(raw: string): string {
  return raw.replace(/\r/g, '').trim();
}

function parseResultText(file: string): string {
  const parsed = JSON.parse(file) as { result?: unknown };
  if (!parsed || !Array.isArray(parsed.result) || parsed.result.length === 0) {
    throw new Error('structured:simple produced no results');
  }
  const value = parsed.result[0];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('structured:simple returned an empty text result');
  }
  return value.trim();
}

function replaceToken(template: string, token: string, value: string): string {
  return template.split(token).join(value);
}

function normalizeTemplateFile(raw: string): string {
  return raw.replace(/\r/g, '').trim();
}

function finalizeTemplate(template: string): string {
  return template.replace(/\n{3,}/g, '\n\n').trim();
}

async function readTemplateFile(filePath: string): Promise<string> {
  const raw = await fs.readFile(filePath, 'utf8');
  const normalized = normalizeTemplateFile(raw);
  if (!normalized) {
    throw new Error(`Character text template file is empty: ${filePath}`);
  }
  return normalized;
}

async function loadCharacterTextTemplates(): Promise<CharacterTextTemplates> {
  if (cachedCharacterTextTemplates) return cachedCharacterTextTemplates;
  if (characterTextTemplatesPromise) return characterTextTemplatesPromise;

  characterTextTemplatesPromise = (async () => {
    const [generateTemplate, refineTemplate, toneNeutral, tonePlayful, toneAngry] = await Promise.all([
      readTemplateFile(TEMPLATE_FILE_PATHS.generate),
      readTemplateFile(TEMPLATE_FILE_PATHS.refine),
      readTemplateFile(TEMPLATE_FILE_PATHS.toneNeutral),
      readTemplateFile(TEMPLATE_FILE_PATHS.tonePlayful),
      readTemplateFile(TEMPLATE_FILE_PATHS.toneAngry),
    ]);

    return {
      generateTemplate,
      refineTemplate,
      toneInstructions: {
        neutral: toneNeutral,
        playful: tonePlayful,
        angry: toneAngry,
      },
    };
  })();

  try {
    cachedCharacterTextTemplates = await characterTextTemplatesPromise;
    return cachedCharacterTextTemplates;
  } finally {
    characterTextTemplatesPromise = null;
  }
}

function resolveTargetWordCount(durationSeconds?: number | null): number {
  const duration = typeof durationSeconds === 'number' && Number.isFinite(durationSeconds) && durationSeconds > 0
    ? durationSeconds
    : 30;
  const target = Math.round(duration * 2.5);
  return Math.max(45, Math.min(260, target));
}

async function buildGenerateTemplate(params: { tone: ContentTone; targetWords: number; language: string | null }): Promise<string> {
  const templates = await loadCharacterTextTemplates();
  const languageLine = params.language?.trim() ? `Language: ${params.language.trim()}.` : '';
  const rendered = replaceToken(
    replaceToken(
      replaceToken(
        replaceToken(
          templates.generateTemplate,
          TEMPLATE_PLACEHOLDERS.languageLine,
          languageLine,
        ),
        TEMPLATE_PLACEHOLDERS.toneInstruction,
        templates.toneInstructions[params.tone],
      ),
      TEMPLATE_PLACEHOLDERS.targetWords,
      String(params.targetWords),
    ),
    TEMPLATE_PLACEHOLDERS.currentTextItem,
    STRUCTURED_PLACEHOLDER,
  );
  return finalizeTemplate(rendered);
}

async function buildRefineTemplate(params: { tone: ContentTone; targetWords: number; language: string | null }): Promise<string> {
  const templates = await loadCharacterTextTemplates();
  const languageLine = params.language?.trim() ? `Language: ${params.language.trim()}.` : '';
  const rendered = replaceToken(
    replaceToken(
      replaceToken(
        replaceToken(
          templates.refineTemplate,
          TEMPLATE_PLACEHOLDERS.languageLine,
          languageLine,
        ),
        TEMPLATE_PLACEHOLDERS.toneInstruction,
        templates.toneInstructions[params.tone],
      ),
      TEMPLATE_PLACEHOLDERS.targetWords,
      String(params.targetWords),
    ),
    TEMPLATE_PLACEHOLDERS.currentTextItem,
    STRUCTURED_PLACEHOLDER,
  );
  return finalizeTemplate(rendered);
}

async function runStructuredSimple(
  templateContent: string,
  inputItem: string,
  workspaceRoot: string | null | undefined,
): Promise<{ text: string; command: string; args: string[] }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'character-text-v2-'));
  const templatePath = path.join(dir, 'template.txt');
  const inputPath = path.join(dir, 'input.json');
  const outputPath = path.join(dir, 'output.json');
  await fs.writeFile(templatePath, templateContent, 'utf8');
  await fs.writeFile(inputPath, JSON.stringify([inputItem], null, 2), 'utf8');

  const args = [
    'run',
    'structured:simple',
    '--',
    '--prompt-template',
    templatePath,
    '--input',
    inputPath,
    '--output',
    outputPath,
    '--model',
    DEFAULT_MODEL,
    '--reasoning',
    DEFAULT_REASONING,
    '--threads',
    String(DEFAULT_THREADS),
    '--max-attempts',
    String(DEFAULT_MAX_ATTEMPTS),
    '--cooldown-ms',
    String(DEFAULT_COOLDOWN_MS),
  ];

  const command = `npm ${args.map((arg) => quoteArg(arg)).join(' ')}`;
  const commandLine = formatCommandForCommandsLog({ cmd: 'npm', args, cwd: cfg.scriptWorkspaceV2 });

  try {
    await withWorkspaceCommandLog({
      workspaceRoot,
      commandLine,
      run: async () =>
        new Promise<string>((resolve, reject) => {
          const child = spawn('npm', args, {
            cwd: cfg.scriptWorkspaceV2,
            env: process.env,
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          let out = '';
          let err = '';
          child.stdout.on('data', (chunk) => {
            out += chunk.toString();
          });
          child.stderr.on('data', (chunk) => {
            err += chunk.toString();
          });
          child.once('error', (spawnError) => {
            reject(new Error(`Failed to start structured:simple: ${spawnError?.message || spawnError}`));
          });
          child.once('close', (code) => {
            if (code !== 0) {
              reject(new Error(err.trim() || out.trim() || `structured:simple exited with code ${code}`));
              return;
            }
            resolve(sanitizeOutput(out));
          });
        }),
    });

    const raw = await fs.readFile(outputPath, 'utf8');
    const text = parseResultText(raw);
    if (!text.trim()) {
      throw new Error('structured:simple generated an empty script');
    }
    return { text, command, args };
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function generateCharacterScriptV2(options: GenerateOptions): Promise<CharacterTextV2Result> {
  const normalizedTone = normalizeContentTone(options.tone);
  const targetWords = resolveTargetWordCount(options.durationSeconds);
  const template = await buildGenerateTemplate({
    tone: normalizedTone,
    targetWords,
    language: options.language ?? null,
  });
  const prompt = options.prompt.trim();
  if (!prompt) {
    throw new CharacterTextV2Error('Prompt is required for character text generation', 'structured:simple');
  }
  try {
    return await runStructuredSimple(template, prompt, options.workspaceRoot);
  } catch (err: any) {
    throw new CharacterTextV2Error(err?.message || String(err), 'structured:simple');
  }
}

export async function refineCharacterScriptV2(options: RefineOptions): Promise<CharacterTextV2Result> {
  const normalizedTone = normalizeContentTone(options.tone);
  const targetWords = resolveTargetWordCount(options.durationSeconds);
  const template = await buildRefineTemplate({
    tone: normalizedTone,
    targetWords,
    language: options.language ?? null,
  });
  const script = options.script.trim();
  const instructions = options.instructions.trim();
  if (!script) {
    throw new CharacterTextV2Error('Original script is required for character text refinement', 'structured:simple');
  }
  if (!instructions) {
    throw new CharacterTextV2Error('Refinement instructions are required', 'structured:simple');
  }
  const packedInput = [
    '[ORIGINAL SCRIPT]',
    script,
    '',
    '[REFINEMENT REQUEST]',
    instructions,
  ].join('\n');
  try {
    return await runStructuredSimple(template, packedInput, options.workspaceRoot);
  } catch (err: any) {
    throw new CharacterTextV2Error(err?.message || String(err), 'structured:simple');
  }
}
