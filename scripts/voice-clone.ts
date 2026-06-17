#!/usr/bin/env tsx
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env'), quiet: true });

const DEFAULT_VOICE_PATH = 'public/voices/inworld/russian/nikolai.mp3';
const DEFAULT_LANGUAGE = 'Russian';
const DEFAULT_NUM_STEP = 32;
const DEFAULT_SPEED = 1.0;
const DEFAULT_CONCURRENCY = 10;
const DEFAULT_SOURCE_DIR = 'public/voices';
const DEFAULT_TARGET_DIR = 'public/voices-clone';
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_POLL_MS = 5000;
const DEFAULT_REQUEST_TIMEOUT_MS = 120000;
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.ogg', '.flac']);
const DEFAULT_BATCH_LANGUAGES = [
  'english',
  'russian',
  'spanish',
  'french',
  'german',
  'portuguese',
  'italian',
] as const;
const BOOLEAN_OPTIONS = new Set(['batch', 'force', 'dry-run', 'quiet', 'sync']);
const DEFAULT_TEXT = [
  'Сегодня я хочу спокойно рассказать одну короткую историю.',
  'Утром город проснулся под мягкий шум дождя, и даже самые обычные улицы выглядели немного кинематографично.',
  'Я вышел за хлебом, но задержался у витрины старой книжной лавки.',
  'Там лежала тетрадь без названия, с пожелтевшими страницами и аккуратным почерком.',
  'Внутри было всего несколько строк о том, что важные решения редко звучат громко.',
  'Они приходят тихо, когда человек наконец готов услышать самого себя.',
].join(' ');

const LANGUAGE_TEXTS: Record<string, { language: string; text: string }> = {
  english: {
    language: 'English',
    text: 'YumCut helps turn a simple idea into a short video quickly. Write a prompt, choose a voice and style, and the service prepares a clean result for social platforms.',
  },
  russian: {
    language: 'Russian',
    text: 'YumCut помогает быстро превратить простую идею в короткое видео. Напишите промпт, выберите голос и стиль, а сервис подготовит аккуратный ролик для социальных сетей.',
  },
  spanish: {
    language: 'Spanish',
    text: 'YumCut ayuda a convertir una idea sencilla en un video corto rápidamente. Escribe un prompt, elige una voz y un estilo, y el servicio prepara un resultado limpio para redes sociales.',
  },
  french: {
    language: 'French',
    text: 'YumCut aide à transformer rapidement une idée simple en courte vidéo. Écrivez un prompt, choisissez une voix et un style, puis le service prépare un résultat propre pour les réseaux sociaux.',
  },
  german: {
    language: 'German',
    text: 'YumCut hilft dabei, eine einfache Idee schnell in ein kurzes Video zu verwandeln. Schreibe einen Prompt, wähle Stimme und Stil, und der Dienst erstellt ein sauberes Ergebnis für soziale Medien.',
  },
  portuguese: {
    language: 'Portuguese',
    text: 'O YumCut ajuda a transformar rapidamente uma ideia simples em um vídeo curto. Escreva um prompt, escolha uma voz e um estilo, e o serviço prepara um resultado limpo para redes sociais.',
  },
  italian: {
    language: 'Italian',
    text: 'YumCut aiuta a trasformare rapidamente una semplice idea in un video breve. Scrivi un prompt, scegli voce e stile, e il servizio prepara un risultato pulito per i social.',
  },
};

type CliOptions = {
  apiKey?: string;
  endpointId?: string;
  batch: boolean;
  voice: string;
  text?: string;
  textFile?: string;
  refText?: string;
  refTextFile?: string;
  out: string;
  sourceDir: string;
  targetDir: string;
  languages: string[];
  concurrency: number;
  force: boolean;
  dryRun: boolean;
  language: string;
  numStep: number;
  speed: number;
  requestId: string;
  timeoutMs: number;
  pollMs: number;
  requestTimeoutMs: number;
  sync: boolean;
  quiet: boolean;
};

type RunpodConfig = {
  endpointId: string;
  apiKey: string;
};

type RunpodResponse = Record<string, unknown>;

type InlineArtifact = {
  filename?: string;
  size?: number;
  contentType?: string;
  dataBase64?: string;
};

type WorkerOutput = {
  ok?: boolean;
  error?: string;
  artifacts?: {
    audio?: InlineArtifact;
  };
  timing?: Record<string, unknown>;
};

type BatchTask = {
  sourcePath: string;
  targetPath: string;
  relativePath: string;
  languageKey: string;
  language: string;
  text: string;
};

type BatchResult = {
  source: string;
  target: string;
  language: string;
  status: 'created' | 'skipped' | 'failed' | 'dry-run';
  elapsedSeconds?: number;
  bytes?: number;
  error?: string;
};

function printUsage(message?: string): never {
  if (message) {
    console.error(`Error: ${message}`);
  }
  console.log(`
Usage:
  npm run voice:clone -- [options]

Options:
  --voice <path>              Reference voice file. Default: ${DEFAULT_VOICE_PATH}
  --text <text>               Text to synthesize. Defaults to a ~30 second Russian sample.
  --text-file <path>          Read synthesis text from a UTF-8 file.
  --ref-text <text>           Optional transcript of the reference voice file.
  --ref-text-file <path>      Read reference transcript from a UTF-8 file.
  --out <path>                Output audio path. Default: FILES/voice-clone/nikolai-clone-<timestamp>.wav
  --batch                     Clone all selected language voice samples.
  --source-dir <path>         Batch source directory. Default: ${DEFAULT_SOURCE_DIR}
  --target-dir <path>         Batch target directory. Default: ${DEFAULT_TARGET_DIR}
  --languages <list>          Batch language folders. Default: ${DEFAULT_BATCH_LANGUAGES.join(',')}
  --concurrency <number>      Batch parallel jobs. Default: ${DEFAULT_CONCURRENCY}
  --force                     Recreate files even when output exists. Default: false
  --dry-run                   List batch work without calling RunPod. Default: false
  --num-step <number>         Quality/speed tradeoff. Default: ${DEFAULT_NUM_STEP}
  --speed <number>            Speech speed. Default: ${DEFAULT_SPEED}
  --language <name>           Worker language hint. Default: ${DEFAULT_LANGUAGE}
  --endpoint-id <id>          Overrides VOICE_CLONE_RUNPOD_ENDPOINT_ID.
  --api-key <key>             Overrides VOICE_CLONE_RUNPOD_API_KEY.
  --sync true|false           Use /runsync instead of async /run + /status. Default: false.
  --timeout-ms <number>       Local async polling timeout. Default: ${DEFAULT_TIMEOUT_MS}
  --poll-ms <number>          Async polling interval. Default: ${DEFAULT_POLL_MS}

Environment:
  VOICE_CLONE_RUNPOD_API_KEY
  VOICE_CLONE_RUNPOD_ENDPOINT_ID
`);
  process.exit(message ? 1 : 0);
}

function parseArgs(argv: string[]): CliOptions {
  const timestamp = stamp();
  const options: CliOptions = {
    batch: false,
    voice: DEFAULT_VOICE_PATH,
    out: path.join('FILES', 'voice-clone', `nikolai-clone-${timestamp}.wav`),
    sourceDir: DEFAULT_SOURCE_DIR,
    targetDir: DEFAULT_TARGET_DIR,
    languages: [...DEFAULT_BATCH_LANGUAGES],
    concurrency: DEFAULT_CONCURRENCY,
    force: false,
    dryRun: false,
    language: DEFAULT_LANGUAGE,
    numStep: DEFAULT_NUM_STEP,
    speed: DEFAULT_SPEED,
    requestId: `voice-clone-${timestamp}`,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    pollMs: DEFAULT_POLL_MS,
    requestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
    sync: false,
    quiet: false,
  };

  if (argv.includes('--help') || argv.includes('-h')) {
    printUsage();
  }

  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index] ?? '';
    if (!raw.startsWith('--')) {
      printUsage(`Unexpected argument: ${raw}`);
    }
    const equalsIndex = raw.indexOf('=');
    const rawKey = equalsIndex >= 0 ? raw.slice(2, equalsIndex) : raw.slice(2);
    const inlineValue = equalsIndex >= 0 ? raw.slice(equalsIndex + 1) : undefined;
    const key = rawKey.trim();
    const next = argv[index + 1];
    const value = inlineValue
      ?? (BOOLEAN_OPTIONS.has(key) && (!next || next.startsWith('--')) ? 'true' : takeNextValue(argv, index, raw));
    if (inlineValue == null && !(BOOLEAN_OPTIONS.has(key) && (!next || next.startsWith('--')))) index += 1;

    switch (key) {
      case 'api-key':
        options.apiKey = value;
        break;
      case 'endpoint-id':
        options.endpointId = value;
        break;
      case 'batch':
        options.batch = parseBoolean(value, '--batch');
        break;
      case 'voice':
        options.voice = value;
        break;
      case 'text':
        options.text = value;
        break;
      case 'text-file':
        options.textFile = value;
        break;
      case 'ref-text':
        options.refText = value;
        break;
      case 'ref-text-file':
        options.refTextFile = value;
        break;
      case 'out':
        options.out = value;
        break;
      case 'source-dir':
        options.sourceDir = value;
        break;
      case 'target-dir':
        options.targetDir = value;
        break;
      case 'languages':
        options.languages = parseLanguages(value);
        break;
      case 'concurrency':
        options.concurrency = Math.max(1, Math.floor(parsePositiveNumber(value, '--concurrency')));
        break;
      case 'force':
        options.force = parseBoolean(value, '--force');
        break;
      case 'dry-run':
        options.dryRun = parseBoolean(value, '--dry-run');
        break;
      case 'language':
        options.language = value;
        break;
      case 'num-step':
        options.numStep = parsePositiveNumber(value, '--num-step');
        break;
      case 'speed':
        options.speed = parsePositiveNumber(value, '--speed');
        break;
      case 'request-id':
        options.requestId = value;
        break;
      case 'timeout-ms':
        options.timeoutMs = parsePositiveNumber(value, '--timeout-ms');
        break;
      case 'poll-ms':
        options.pollMs = parsePositiveNumber(value, '--poll-ms');
        break;
      case 'request-timeout-ms':
        options.requestTimeoutMs = parsePositiveNumber(value, '--request-timeout-ms');
        break;
      case 'sync':
        options.sync = parseBoolean(value, '--sync');
        break;
      case 'quiet':
        options.quiet = parseBoolean(value, '--quiet');
        break;
      default:
        printUsage(`Unknown option: --${key}`);
    }
  }

  if (options.text && options.textFile) {
    printUsage('Use either --text or --text-file, not both.');
  }
  if (options.refText && options.refTextFile) {
    printUsage('Use either --ref-text or --ref-text-file, not both.');
  }
  return options;
}

function takeNextValue(argv: string[], index: number, raw: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    printUsage(`Missing value for ${raw}`);
  }
  return value;
}

function parsePositiveNumber(value: string, label: string): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    printUsage(`${label} must be a positive number.`);
  }
  return numberValue;
}

function parseBoolean(value: string, label: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n'].includes(normalized)) return false;
  printUsage(`${label} must be true or false.`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const runpod = resolveRunpodConfig(options);

  if (options.batch) {
    await runBatch(options, runpod);
    return;
  }

  const voicePath = path.resolve(options.voice);
  const outPath = path.resolve(options.out);
  const text = await resolveText(options.text, options.textFile, DEFAULT_TEXT);
  const refText = await resolveText(options.refText, options.refTextFile, '');

  await assertReadableFile(voicePath, 'voice');
  await fs.mkdir(path.dirname(outPath), { recursive: true });

  const payload = await buildPayload({
    requestId: options.requestId,
    voicePath,
    text,
    refText,
    language: options.language,
    numStep: options.numStep,
    speed: options.speed,
  });

  log(options, `Submitting ${options.sync ? 'sync' : 'async'} RunPod voice clone job ${options.requestId}`);
  log(options, `Voice: ${voicePath}`);
  log(options, `Output: ${outPath}`);
  log(options, `Quality: num_step=${options.numStep}, speed=${options.speed}, language=${options.language}`);

  const startedAt = performance.now();
  const response = await callRunpod(runpod.endpointId, runpod.apiKey, payload, options);
  const elapsedMs = performance.now() - startedAt;
  const output = extractWorkerOutput(response);
  if (!output.ok) {
    throw new Error(`RunPod worker failed: ${output.error || JSON.stringify(stripArtifactData(response)).slice(0, 1500)}`);
  }

  const artifact = output.artifacts?.audio;
  if (!artifact?.dataBase64) {
    throw new Error(`RunPod response did not include inline audio: ${JSON.stringify(stripArtifactData(response)).slice(0, 1500)}`);
  }

  const audio = Buffer.from(artifact.dataBase64, 'base64');
  await writeAudioFile(audio, outPath);

  const responsePath = `${outPath}.response.json`;
  const timingPath = `${outPath}.timing.txt`;
  await fs.writeFile(responsePath, `${JSON.stringify(stripArtifactData(response), null, 2)}\n`, 'utf8');
  await fs.writeFile(timingPath, buildTimingText({ endpointId: runpod.endpointId, requestId: options.requestId, elapsedMs, outputPath: outPath, artifact, timing: output.timing }), 'utf8');

  console.log(JSON.stringify({
    ok: true,
    output: outPath,
    response: responsePath,
    timing: timingPath,
    bytes: audio.length,
    elapsedSeconds: Number((elapsedMs / 1000).toFixed(2)),
    workerTiming: output.timing ?? null,
  }, null, 2));
}

function resolveRunpodConfig(options: CliOptions): RunpodConfig {
  const endpointId = (options.endpointId || process.env.VOICE_CLONE_RUNPOD_ENDPOINT_ID || process.env.RUNPOD_ENDPOINT_ID || '').trim();
  const apiKey = (options.apiKey || process.env.VOICE_CLONE_RUNPOD_API_KEY || process.env.RUNPOD_API_KEY || '').trim();
  if (!endpointId) throw new Error('VOICE_CLONE_RUNPOD_ENDPOINT_ID is not configured.');
  if (!apiKey) throw new Error('VOICE_CLONE_RUNPOD_API_KEY is not configured.');
  return { endpointId, apiKey };
}

function parseLanguages(value: string): string[] {
  const languages = value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (languages.length === 0) {
    printUsage('--languages must contain at least one language.');
  }
  for (const language of languages) {
    if (!LANGUAGE_TEXTS[language]) {
      printUsage(`Unsupported language in --languages: ${language}`);
    }
  }
  return Array.from(new Set(languages));
}

async function runBatch(options: CliOptions, runpod: RunpodConfig) {
  const startedAt = performance.now();
  const tasks = await discoverBatchTasks(options);
  const skipped: BatchResult[] = [];
  const pending: BatchTask[] = [];

  for (const task of tasks) {
    if (!options.force && await fileExists(task.targetPath)) {
      skipped.push({
        source: task.sourcePath,
        target: task.targetPath,
        language: task.languageKey,
        status: 'skipped',
      });
      continue;
    }
    pending.push(task);
  }

  log(options, `Batch source: ${path.resolve(options.sourceDir)}`);
  log(options, `Batch target: ${path.resolve(options.targetDir)}`);
  log(options, `Batch languages: ${options.languages.join(', ')}`);
  log(options, `Batch tasks: total=${tasks.length}, pending=${pending.length}, skipped=${skipped.length}, concurrency=${options.concurrency}`);

  if (options.dryRun) {
    const dryRunResults = pending.map((task): BatchResult => ({
      source: task.sourcePath,
      target: task.targetPath,
      language: task.languageKey,
      status: 'dry-run',
    }));
    const results = [...skipped, ...dryRunResults];
    await writeBatchManifest(options, results, performance.now() - startedAt);
    console.log(JSON.stringify(batchSummary(results, performance.now() - startedAt), null, 2));
    return;
  }

  const results: BatchResult[] = [...skipped];
  let cursor = 0;
  const workerCount = Math.min(options.concurrency, pending.length);

  async function worker(workerId: number) {
    while (true) {
      const task = pending[cursor];
      cursor += 1;
      if (!task) return;
      const index = cursor;
      log(options, `[${index}/${pending.length}] worker=${workerId} cloning ${task.relativePath}`);
      const result = await cloneBatchTask(task, options, runpod);
      results.push(result);
      await writeBatchManifest(options, results, performance.now() - startedAt);
      if (result.status === 'failed') {
        console.error(`[voice:clone] failed ${task.relativePath}: ${result.error}`);
      } else {
        log(options, `[${index}/${pending.length}] done ${task.relativePath} -> ${task.targetPath}`);
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, (_, index) => worker(index + 1)));

  const elapsedMs = performance.now() - startedAt;
  await writeBatchManifest(options, results, elapsedMs);
  const summary = batchSummary(results, elapsedMs);
  console.log(JSON.stringify(summary, null, 2));
  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

async function cloneBatchTask(task: BatchTask, options: CliOptions, runpod: RunpodConfig): Promise<BatchResult> {
  const startedAt = performance.now();
  try {
    await fs.mkdir(path.dirname(task.targetPath), { recursive: true });
    const payload = await buildPayload({
      requestId: `voice-clone-${task.languageKey}-${sanitizeRequestPart(task.relativePath)}-${Date.now()}`,
      voicePath: task.sourcePath,
      text: task.text,
      refText: '',
      language: task.language,
      numStep: options.numStep,
      speed: options.speed,
    });
    const response = await callRunpod(runpod.endpointId, runpod.apiKey, payload, options);
    const output = extractWorkerOutput(response);
    if (!output.ok) {
      throw new Error(output.error || JSON.stringify(stripArtifactData(response)).slice(0, 1000));
    }
    const artifact = output.artifacts?.audio;
    if (!artifact?.dataBase64) {
      throw new Error(`RunPod response did not include inline audio: ${JSON.stringify(stripArtifactData(response)).slice(0, 1000)}`);
    }
    const audio = Buffer.from(artifact.dataBase64, 'base64');
    await writeAudioFile(audio, task.targetPath);
    const stat = await fs.stat(task.targetPath);
    return {
      source: task.sourcePath,
      target: task.targetPath,
      language: task.languageKey,
      status: 'created',
      elapsedSeconds: Number(((performance.now() - startedAt) / 1000).toFixed(2)),
      bytes: stat.size,
    };
  } catch (error) {
    return {
      source: task.sourcePath,
      target: task.targetPath,
      language: task.languageKey,
      status: 'failed',
      elapsedSeconds: Number(((performance.now() - startedAt) / 1000).toFixed(2)),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function discoverBatchTasks(options: CliOptions): Promise<BatchTask[]> {
  const sourceRoot = path.resolve(options.sourceDir);
  const targetRoot = path.resolve(options.targetDir);
  const languageSet = new Set(options.languages.map((item) => item.toLowerCase()));
  const files = await collectAudioFiles(sourceRoot);
  const tasks: BatchTask[] = [];
  for (const sourcePath of files) {
    const relativePath = path.relative(sourceRoot, sourcePath);
    const parts = relativePath.split(path.sep);
    const languageKey = parts.find((part) => languageSet.has(part.toLowerCase()))?.toLowerCase();
    if (!languageKey) continue;
    const language = LANGUAGE_TEXTS[languageKey];
    if (!language) continue;
    tasks.push({
      sourcePath,
      targetPath: path.join(targetRoot, relativePath),
      relativePath,
      languageKey,
      language: language.language,
      text: language.text,
    });
  }
  return tasks.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

async function collectAudioFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => null);
  if (!entries) {
    throw new Error(`Source directory is not readable: ${root}`);
  }
  const files: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectAudioFiles(entryPath));
      continue;
    }
    if (entry.isFile() && AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(entryPath);
    }
  }
  return files;
}

async function writeBatchManifest(options: CliOptions, results: BatchResult[], elapsedMs: number) {
  const targetRoot = path.resolve(options.targetDir);
  await fs.mkdir(targetRoot, { recursive: true });
  const manifestPath = path.join(targetRoot, 'voice-clone-manifest.json');
  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceDir: path.resolve(options.sourceDir),
    targetDir: targetRoot,
    languages: options.languages,
    concurrency: options.concurrency,
    numStep: options.numStep,
    speed: options.speed,
    elapsedSeconds: Number((elapsedMs / 1000).toFixed(2)),
    summary: batchSummary(results, elapsedMs),
    results,
  };
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function batchSummary(results: BatchResult[], elapsedMs: number) {
  return {
    total: results.length,
    created: results.filter((result) => result.status === 'created').length,
    skipped: results.filter((result) => result.status === 'skipped').length,
    failed: results.filter((result) => result.status === 'failed').length,
    dryRun: results.filter((result) => result.status === 'dry-run').length,
    elapsedSeconds: Number((elapsedMs / 1000).toFixed(2)),
  };
}

function sanitizeRequestPart(value: string): string {
  return value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 120) || 'voice';
}

async function resolveText(value: string | undefined, filePath: string | undefined, fallback: string): Promise<string> {
  const text = filePath ? await fs.readFile(path.resolve(filePath), 'utf8') : value ?? fallback;
  const normalized = text.trim();
  if (!normalized && fallback) return fallback;
  return normalized;
}

async function assertReadableFile(filePath: string, label: string) {
  const stat = await fs.stat(filePath).catch(() => null);
  if (!stat?.isFile()) {
    throw new Error(`${label} file is not readable: ${filePath}`);
  }
}

async function buildPayload(input: {
  requestId: string;
  voicePath: string;
  text: string;
  refText: string;
  language: string;
  numStep: number;
  speed: number;
}) {
  const clone: Record<string, string> = await dataRef(input.voicePath);
  if (input.refText) {
    clone.refText = input.refText;
  }
  return {
    requestId: input.requestId,
    mode: 'speech-only',
    returnMode: 'inline',
    speech: {
      text: input.text,
      voice: { clone },
      params: {
        language: input.language,
        num_step: input.numStep,
        speed: input.speed,
      },
    },
  };
}

async function dataRef(filePath: string): Promise<{ data: string }> {
  const bytes = await fs.readFile(filePath);
  const mime = mimeForPath(filePath);
  return { data: `data:${mime};base64,${bytes.toString('base64')}` };
}

async function writeAudioFile(audio: Buffer, targetPath: string) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  const ext = path.extname(targetPath).toLowerCase();
  if (ext === '.mp3') {
    await writeMp3(audio, targetPath);
    return;
  }
  await fs.writeFile(targetPath, audio);
}

async function writeMp3(wavAudio: Buffer, targetPath: string) {
  const tempPath = `${targetPath}.${process.pid}.${Date.now()}.tmp.wav`;
  await fs.writeFile(tempPath, wavAudio);
  try {
    await runCommand('ffmpeg', [
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      tempPath,
      '-codec:a',
      'libmp3lame',
      '-b:a',
      '192k',
      targetPath,
    ]);
  } finally {
    await fs.rm(tempPath, { force: true }).catch(() => {});
  }
}

function runCommand(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'ignore' });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function fileExists(filePath: string) {
  return !!(await fs.stat(filePath).catch(() => null));
}

function mimeForPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.mp3') return 'audio/mpeg';
  if (ext === '.wav') return 'audio/wav';
  if (ext === '.m4a') return 'audio/mp4';
  if (ext === '.ogg') return 'audio/ogg';
  if (ext === '.flac') return 'audio/flac';
  return 'application/octet-stream';
}

async function callRunpod(endpointId: string, apiKey: string, payload: unknown, options: CliOptions): Promise<RunpodResponse> {
  if (options.sync) {
    return postJson(`https://api.runpod.ai/v2/${endpointId}/runsync`, apiKey, { input: payload }, options.requestTimeoutMs);
  }

  const run = await postJson(`https://api.runpod.ai/v2/${endpointId}/run`, apiKey, { input: payload }, options.requestTimeoutMs);
  const jobId = typeof run.id === 'string' ? run.id : '';
  if (!jobId) {
    throw new Error(`RunPod did not return a job id: ${JSON.stringify(run).slice(0, 1000)}`);
  }

  log(options, `RunPod job submitted: ${jobId}`);
  const deadline = Date.now() + options.timeoutMs;
  let lastStatus = '';
  while (Date.now() < deadline) {
    const status = await getJson(`https://api.runpod.ai/v2/${endpointId}/status/${jobId}`, apiKey, options.requestTimeoutMs);
    const statusValue = typeof status.status === 'string' ? status.status : '';
    if (statusValue === 'COMPLETED') return status;
    if (['FAILED', 'CANCELLED', 'TIMED_OUT'].includes(statusValue)) {
      throw new Error(`RunPod job ${statusValue}: ${JSON.stringify(status).slice(0, 2000)}`);
    }
    if (statusValue !== lastStatus) {
      lastStatus = statusValue;
      log(options, `RunPod job ${jobId} status: ${statusValue || 'unknown'}`);
    }
    await sleep(options.pollMs);
  }
  throw new Error(`RunPod job timed out locally after ${options.timeoutMs}ms: ${jobId}`);
}

async function postJson(url: string, apiKey: string, payload: unknown, timeoutMs: number): Promise<RunpodResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });
  return readJsonResponse(response);
}

async function getJson(url: string, apiKey: string, timeoutMs: number): Promise<RunpodResponse> {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(timeoutMs),
  });
  return readJsonResponse(response);
}

async function readJsonResponse(response: Response): Promise<RunpodResponse> {
  const text = await response.text();
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(`RunPod ${response.status}: check VOICE_CLONE_RUNPOD_API_KEY permission and VOICE_CLONE_RUNPOD_ENDPOINT_ID. ${text.slice(0, 1000)}`);
    }
    throw new Error(`RunPod ${response.status}: ${text.slice(0, 1000)}`);
  }
  return JSON.parse(text) as RunpodResponse;
}

function extractWorkerOutput(response: RunpodResponse): WorkerOutput {
  const output = response.output;
  if (output && typeof output === 'object' && !Array.isArray(output)) {
    return output as WorkerOutput;
  }
  return response as WorkerOutput;
}

function stripArtifactData(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (key, current) => (
    key === 'dataBase64' ? `<base64:${String(current).length}>` : current
  )));
}

function buildTimingText(input: {
  endpointId: string;
  requestId: string;
  elapsedMs: number;
  outputPath: string;
  artifact: InlineArtifact;
  timing?: Record<string, unknown>;
}) {
  const lines = [
    `Voice clone RunPod job: ${new Date().toISOString()}`,
    `Endpoint: ${input.endpointId}`,
    `Request ID: ${input.requestId}`,
    `Output: ${input.outputPath}`,
    `Wall time: ${(input.elapsedMs / 1000).toFixed(2)}s`,
    `Artifact size: ${input.artifact.size ?? 'unknown'} bytes`,
    `Content type: ${input.artifact.contentType ?? 'unknown'}`,
  ];
  const totalSeconds = readNestedNumber(input.timing, ['total_seconds']);
  if (totalSeconds != null) {
    lines.push(`Worker total: ${totalSeconds.toFixed(2)}s`);
  }
  const steps = input.timing?.steps;
  if (steps && typeof steps === 'object' && !Array.isArray(steps)) {
    for (const [step, raw] of Object.entries(steps)) {
      const seconds = readNestedNumber(raw, ['seconds']);
      const ok = raw && typeof raw === 'object' && 'ok' in raw ? String((raw as { ok?: unknown }).ok) : 'unknown';
      lines.push(`${step}: ${seconds == null ? 'unknown' : `${seconds.toFixed(2)}s`} ok=${ok}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function readNestedNumber(value: unknown, pathParts: string[]): number | null {
  let current = value;
  for (const part of pathParts) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return null;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'number' && Number.isFinite(current) ? current : null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(options: CliOptions, message: string) {
  if (options.quiet) return;
  console.error(`[voice:clone] ${new Date().toISOString()} ${message}`);
}

function stamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
});
