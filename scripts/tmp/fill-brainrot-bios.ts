import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

const MAX_CONCURRENCY = 10;
const RESEARCH_TIMEOUT_MS = 600000;
const TRANSLATION_TIMEOUT_MS = 540000;
const TRANSLATION_FALLBACK_RESET_MS = 60 * 60 * 1000;
const BIO_MAX = 255;
const LONG_BIO_MIN = 3000;
const LONG_BIO_MAX = 5000;

const DEFAULT_TRANSLATION_PRIMARY_MODEL = 'gpt-5.3-codex-spark';
const DEFAULT_TRANSLATION_PRIMARY_REASONING: ReasoningEffort = 'low';
const DEFAULT_TRANSLATION_FALLBACK_MODEL = 'gpt-5.3-codex';
const DEFAULT_TRANSLATION_FALLBACK_REASONING: ReasoningEffort = 'low';
const DEFAULT_OLLAMA_HOST = 'http://127.0.0.1:11434';
const DEFAULT_OLLAMA_MODEL = 'gemma4:26b';
const DEFAULT_CODEX_COMMAND = 'codex-proxy';

const DEFAULT_TARGET_LOCALES = [
  'en',
  'es',
  'hi',
  'zh',
  'th',
  'ko',
  'ja',
  'de',
  'pl',
  'fr',
  'it',
  'nl',
  'tr',
  'id',
  'ar',
  'vi',
  'fa',
  'ru',
  'pt',
  'ur',
  'bn',
  'am',
  'fil',
  'uk',
] as const;
const CODEX_OUTPUT_DIR = path.join(os.tmpdir(), 'yumcut-brainrot-codex-output');

type LocaleCode = string;
type ReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';
type TranslationBackend = 'codex' | 'ollama';

interface LocalizedContent {
  name: string;
  title: string;
  bio: string;
  longBio: string;
}

interface ConvertedInfoFile {
  slug: string;
  locales?: Record<string, Partial<LocalizedContent>>;
  researchUpdatedAt?: string;
  name?: string;
  title?: string;
  bio?: string;
  longBio?: string;
}

interface SourceInfo {
  name?: string;
  slug?: string;
  page_url?: string;
  metadata?: {
    ld_creative_work?: {
      description?: string;
      keywords?: string;
      creator?: { name?: string };
      dateCreated?: string;
      genre?: string;
    };
    page_meta?: {
      title?: string;
      description?: string;
      keywords?: string;
      h1?: string;
    };
  };
}

interface CharacterTask {
  dirName: string;
  infoPath: string;
  info: ConvertedInfoFile;
  source: SourceInfo | null;
}

interface RunOptions {
  convertedRoot: string;
  sourceRoot: string;
  characterConcurrency: number;
  languageConcurrency: number;
  limit: number;
  researchModel: string;
  translationModel: string;
  translationModelExplicit: boolean;
  researchReasoning: ReasoningEffort;
  translationReasoning: ReasoningEffort;
  researchTimeoutMs: number;
  translationTimeoutMs: number;
  maxRetries: number;
  onlySlugs: Set<string> | null;
  targetLocales: LocaleCode[];
  translationBackend: TranslationBackend;
  codexCommand: string;
  ollamaModel: string;
  ollamaHost: string;
  inputInfoPath: string | null;
  outputInfoPath: string | null;
  noWrite: boolean;
  qualityReportPath: string | null;
}

interface GenerationPayload {
  name: string;
  title: string;
  bio: string;
  longBio: string;
}

interface TranslationRuntimeModel {
  model: string;
  reasoning: ReasoningEffort;
}

interface TranslationRuntimeController {
  getCurrent: () => TranslationRuntimeModel;
  shouldFallback: (error: unknown) => boolean;
  activateFallback: () => void;
  failoverEnabled: boolean;
  fallbackModel: string;
  fallbackReasoning: ReasoningEffort;
}

type LocalePersistSource = 'research' | 'translation';
type LocalePersistResult = 'written' | 'skipped' | 'simulated';

interface OllamaTranslationFieldMetric {
  field: keyof LocalizedContent;
  sourceChars: number;
  translatedChars: number;
  durationSeconds: number;
  checks: {
    empty: boolean;
    sameAsSource: boolean;
    hasLongDash: boolean;
    paragraphMismatch: boolean;
  };
}

interface OllamaTranslationLocaleReport {
  locale: string;
  localeLabel: string;
  model: string;
  totalDurationSeconds: number;
  fields: OllamaTranslationFieldMetric[];
}

interface PersistLocaleParams {
  infoPath: string;
  charSlug: string;
  logTag: string;
  locale: string;
  content: LocalizedContent;
  source: LocalePersistSource;
}

interface LocaleSaveCoordinator {
  enqueue: (params: PersistLocaleParams) => Promise<LocalePersistResult>;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function formatTimeoutSeconds(timeoutMs: number): string {
  return `${Math.round(timeoutMs / 1000)}s`;
}

function clampSpaces(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

function sanitizeFileTag(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function normalize(input: string | undefined | null): string {
  return (input ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function normalizeLocaleCode(input: string): string {
  return input.trim().toLowerCase().replace(/_/g, '-');
}

function parseLocaleList(input: string | undefined): string[] {
  if (!input || !input.trim()) return [...DEFAULT_TARGET_LOCALES];
  const parsed = Array.from(new Set(
    input
      .split(',')
      .map((item) => normalizeLocaleCode(item))
      .filter(Boolean),
  ));
  if (!parsed.includes('en')) parsed.unshift('en');
  return parsed;
}

function parseReasoningEffort(input: string | undefined, fallback: ReasoningEffort): ReasoningEffort {
  const value = (input ?? '').trim().toLowerCase();
  if (value === 'low' || value === 'medium' || value === 'high' || value === 'xhigh') return value;
  return fallback;
}

function parseArgs(): RunOptions {
  const args = process.argv.slice(2);

  const getArg = (name: string, fallback: string): string => {
    const idx = args.indexOf(name);
    if (idx === -1) return fallback;
    const value = args[idx + 1];
    return value ?? fallback;
  };

  const hasArg = (name: string): boolean => args.includes(name);
  const isEnabled = (name: string): boolean => hasArg(name);

  const convertedRoot = getArg('--converted-root', '/Users/test/Downloads/converted-characters/brainrot');
  const sourceRoot = getArg('--source-root', '/Users/test/Downloads/bra-memes');
  const limitRaw = Number(getArg('--limit', '10'));
  const maxRetriesRaw = Number(getArg('--max-retries', '2'));

  const legacyConcurrencyRaw = Number(getArg('--concurrency', '0'));
  const explicitCharacterConcurrencyRaw = Number(getArg('--character-concurrency', '0'));
  const explicitLanguageConcurrencyRaw = Number(getArg('--language-concurrency', '0'));

  const defaultConcurrency = Number.isFinite(legacyConcurrencyRaw) && legacyConcurrencyRaw > 0
    ? Math.floor(legacyConcurrencyRaw)
    : 10;

  const characterConcurrencyRaw = Number.isFinite(explicitCharacterConcurrencyRaw) && explicitCharacterConcurrencyRaw > 0
    ? Math.floor(explicitCharacterConcurrencyRaw)
    : defaultConcurrency;

  const languageConcurrencyRaw = Number.isFinite(explicitLanguageConcurrencyRaw) && explicitLanguageConcurrencyRaw > 0
    ? Math.floor(explicitLanguageConcurrencyRaw)
    : defaultConcurrency;

  const onlySlugsRaw = getArg('--only-slugs', '');
  const onlySlugs = onlySlugsRaw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const targetLocales = parseLocaleList(getArg('--target-locales', ''));

  const hasLegacyModel = hasArg('--model');
  const hasTranslationModel = hasArg('--translation-model');
  const legacyModel = getArg('--model', '');
  const researchModel = hasLegacyModel
    ? legacyModel
    : getArg('--research-model', 'gpt-5.4');
  const translationModel = hasLegacyModel
    ? legacyModel
    : getArg('--translation-model', DEFAULT_TRANSLATION_PRIMARY_MODEL);

  const translationModelExplicit = hasLegacyModel || hasTranslationModel;

  const researchReasoning = parseReasoningEffort(
    getArg('--research-reasoning', 'medium'),
    'medium',
  );
  const translationReasoning = parseReasoningEffort(
    getArg('--translation-reasoning', String(DEFAULT_TRANSLATION_PRIMARY_REASONING)),
    DEFAULT_TRANSLATION_PRIMARY_REASONING,
  );
  const translationBackend: TranslationBackend = isEnabled('--ollama') ? 'ollama' : 'codex';
  const codexCommandArg = getArg('--codex-cmd', '').trim();
  const codexCommand = codexCommandArg || (isEnabled('--use-codex') ? 'codex' : DEFAULT_CODEX_COMMAND);
  const ollamaModel = getArg('--ollama-model', DEFAULT_OLLAMA_MODEL).trim() || DEFAULT_OLLAMA_MODEL;
  const ollamaHost = getArg('--ollama-host', DEFAULT_OLLAMA_HOST).trim() || DEFAULT_OLLAMA_HOST;
  const inputInfoArg = getArg('--input-info', '').trim();
  const outputInfoArg = getArg('--output-info', '').trim();
  const qualityReportArg = getArg('--quality-report', '').trim();
  const noWrite = isEnabled('--no-write');

  return {
    convertedRoot,
    sourceRoot,
    characterConcurrency: clamp(characterConcurrencyRaw, 1, MAX_CONCURRENCY),
    languageConcurrency: clamp(languageConcurrencyRaw, 1, MAX_CONCURRENCY),
    limit: Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : 10,
    researchModel,
    translationModel,
    translationModelExplicit,
    researchReasoning,
    translationReasoning,
    researchTimeoutMs: clamp(Number(getArg('--research-timeout-ms', String(RESEARCH_TIMEOUT_MS))), 30000, 900000),
    translationTimeoutMs: clamp(Number(getArg('--translation-timeout-ms', String(TRANSLATION_TIMEOUT_MS))), 30000, 1200000),
    maxRetries: Number.isFinite(maxRetriesRaw) && maxRetriesRaw >= 0 ? Math.floor(maxRetriesRaw) : 2,
    onlySlugs: onlySlugs.length > 0 ? new Set(onlySlugs) : null,
    targetLocales,
    translationBackend,
    codexCommand,
    ollamaModel,
    ollamaHost,
    inputInfoPath: inputInfoArg ? path.resolve(inputInfoArg) : null,
    outputInfoPath: outputInfoArg ? path.resolve(outputInfoArg) : null,
    noWrite,
    qualityReportPath: qualityReportArg ? path.resolve(qualityReportArg) : null,
  };
}

function isTranslationModelOrLimitError(error: unknown): boolean {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const msg = raw.toLowerCase();

  const modelPatterns = [
    'model not found',
    'unknown model',
    'invalid model',
    'does not exist',
    'unsupported model',
    'not available',
  ];

  const limitPatterns = [
    'usage limit',
    "you've hit your usage limit",
    'hit your usage limit',
    'try again at',
    'rate limit',
    'quota',
    'tokens per minute',
    'requests per minute',
    'too many requests',
    'context length',
    'maximum context length',
    'token limit',
    'request too large',
  ];

  return modelPatterns.some((pattern) => msg.includes(pattern))
    || limitPatterns.some((pattern) => msg.includes(pattern));
}

function createTranslationRuntimeController(options: RunOptions): TranslationRuntimeController {
  if (options.translationBackend === 'ollama') {
    return {
      getCurrent: () => ({
        model: options.ollamaModel,
        reasoning: DEFAULT_TRANSLATION_PRIMARY_REASONING,
      }),
      shouldFallback: () => false,
      activateFallback: () => undefined,
      failoverEnabled: false,
      fallbackModel: DEFAULT_TRANSLATION_FALLBACK_MODEL,
      fallbackReasoning: DEFAULT_TRANSLATION_FALLBACK_REASONING,
    };
  }

  const failoverEnabled = !options.translationModelExplicit;

  let fallbackActivatedAt: number | null = null;

  const currentConfig = (): TranslationRuntimeModel => {
    if (!failoverEnabled) {
      return {
        model: options.translationModel,
        reasoning: options.translationReasoning,
      };
    }

    if (fallbackActivatedAt && Date.now() - fallbackActivatedAt >= TRANSLATION_FALLBACK_RESET_MS) {
      fallbackActivatedAt = null;
      console.log('[translation-failover] Reset to primary model after 1h cooldown.');
    }

    if (fallbackActivatedAt) {
      return {
        model: DEFAULT_TRANSLATION_FALLBACK_MODEL,
        reasoning: DEFAULT_TRANSLATION_FALLBACK_REASONING,
      };
    }

    return {
      model: options.translationModel,
      reasoning: options.translationReasoning,
    };
  };

  return {
    getCurrent: currentConfig,
    shouldFallback: isTranslationModelOrLimitError,
    activateFallback: () => {
      if (!failoverEnabled) return;
      if (!fallbackActivatedAt) {
        fallbackActivatedAt = Date.now();
        console.log(
          `[translation-failover] Switched all translations to ${DEFAULT_TRANSLATION_FALLBACK_MODEL} (${DEFAULT_TRANSLATION_FALLBACK_REASONING}) for 1h.`,
        );
      }
    },
    failoverEnabled,
    fallbackModel: DEFAULT_TRANSLATION_FALLBACK_MODEL,
    fallbackReasoning: DEFAULT_TRANSLATION_FALLBACK_REASONING,
  };
}

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const tempPath = path.join(
    dir,
    `.${base}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`,
  );

  await fs.writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await fs.rename(tempPath, filePath);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function withFileLock<T>(
  filePath: string,
  execute: () => Promise<T>,
): Promise<T> {
  const lockPath = `${filePath}.lock`;
  const startedAt = Date.now();
  const timeoutMs = 60000;
  const pollMs = 100;
  const staleMs = 15 * 60 * 1000;

  while (true) {
    let handle: Awaited<ReturnType<typeof fs.open>> | null = null;
    try {
      handle = await fs.open(lockPath, 'wx');
      const result = await execute();
      await handle.close();
      await fs.rm(lockPath, { force: true });
      return result;
    } catch (error: any) {
      if (handle) {
        await handle.close().catch(() => undefined);
        await fs.rm(lockPath, { force: true }).catch(() => undefined);
      }

      if (error?.code !== 'EEXIST') {
        throw error;
      }

      try {
        const stat = await fs.stat(lockPath);
        if (Date.now() - stat.mtimeMs > staleMs) {
          await fs.rm(lockPath, { force: true });
          continue;
        }
      } catch {
        // lock disappeared between checks, retry acquire.
      }

      if (Date.now() - startedAt > timeoutMs) {
        throw new Error(`Timeout while waiting lock: ${lockPath}`);
      }

      await sleep(pollMs);
    }
  }
}

async function readCanonicalInfoFile(infoPath: string): Promise<ConvertedInfoFile> {
  const latestRaw = await readJson<ConvertedInfoFile>(infoPath);
  return buildCanonicalInfo(latestRaw);
}

async function isLocaleCompleteOnDisk(infoPath: string, locale: string): Promise<boolean> {
  const latest = await readCanonicalInfoFile(infoPath);
  const current = pickLocale(latest, locale);
  return isCompleteLocale(current);
}

function createLocaleSaveCoordinator(noWrite: boolean): LocaleSaveCoordinator {
  let chain = Promise.resolve();

  const persistNow = async (params: PersistLocaleParams): Promise<LocalePersistResult> => {
    if (noWrite) {
      console.log(`[${params.logTag}] persist:${params.locale} simulated (--no-write)`);
      return 'simulated';
    }

    return withFileLock(params.infoPath, async () => {
      console.log(`[${params.logTag}] persist:${params.locale} lock-acquired (${params.source})`);
      const latest = await readCanonicalInfoFile(params.infoPath);
      const current = pickLocale(latest, params.locale);
      if (isCompleteLocale(current)) {
        return 'skipped';
      }

      latest.locales = latest.locales || {};
      latest.locales[params.locale] = params.content;
      latest.researchUpdatedAt = new Date().toISOString();
      await writeJsonAtomic(params.infoPath, latest);
      return 'written';
    });
  };

  return {
    enqueue: (params: PersistLocaleParams) => {
      const job = chain.then(() => persistNow(params));
      chain = job.then(() => undefined, () => undefined);
      return job;
    },
  };
}

function pickLocale(info: ConvertedInfoFile, locale: string): LocalizedContent {
  const source = info.locales?.[locale] ?? {};
  const en = info.locales?.en ?? {};
  const fallbackName = clampSpaces(String(source.name ?? en.name ?? info.name ?? info.slug ?? ''));
  const fallbackTitle = clampSpaces(String(source.title ?? en.title ?? info.title ?? fallbackName));
  const bio = clampSpaces(String(source.bio ?? ''));
  const longBio = clampSpaces(String(source.longBio ?? ''));

  return {
    name: fallbackName,
    title: fallbackTitle,
    bio,
    longBio,
  };
}

function buildCanonicalInfo(input: ConvertedInfoFile): ConvertedInfoFile {
  const localesOut: Record<string, Partial<LocalizedContent>> = {};

  if (input.locales && typeof input.locales === 'object') {
    for (const [rawCode, value] of Object.entries(input.locales)) {
      const code = normalizeLocaleCode(rawCode);
      if (!code || !value || typeof value !== 'object') continue;
      localesOut[code] = {
        name: clampSpaces(String((value as any).name ?? '')),
        title: clampSpaces(String((value as any).title ?? '')),
        bio: clampSpaces(String((value as any).bio ?? '')),
        longBio: clampSpaces(String((value as any).longBio ?? '')),
      };
    }
  }

  const enFromLocales = localesOut.en ?? {};
  const enResolved: LocalizedContent = {
    name: clampSpaces(String(enFromLocales.name ?? input.name ?? input.slug ?? '')),
    title: clampSpaces(String(enFromLocales.title ?? input.title ?? enFromLocales.name ?? input.name ?? input.slug ?? '')),
    bio: clampSpaces(String(enFromLocales.bio ?? input.bio ?? '')),
    longBio: clampSpaces(String(enFromLocales.longBio ?? input.longBio ?? '')),
  };
  localesOut.en = enResolved;

  const canonical: ConvertedInfoFile = {
    slug: clampSpaces(String(input.slug ?? '')),
    locales: localesOut,
  };

  if (input.researchUpdatedAt && input.researchUpdatedAt.trim()) {
    canonical.researchUpdatedAt = input.researchUpdatedAt;
  }

  return canonical;
}

function isCompleteLocale(entry: LocalizedContent): boolean {
  return (
    entry.name.length > 0
    && entry.title.length > 0
    && entry.bio.length > 0
    && entry.longBio.length > 0
  );
}

function validateGeneratedPayloadStrict(payload: GenerationPayload): LocalizedContent {
  const name = clampSpaces(payload.name ?? '');
  const title = clampSpaces(payload.title ?? '');
  const bio = clampSpaces(payload.bio ?? '');
  let longBio = clampSpaces(payload.longBio ?? '');

  if (!name) throw new Error('name is empty');
  if (!title) throw new Error('title is empty');
  if (!bio) throw new Error('bio is empty');
  if (bio.length > BIO_MAX) throw new Error(`bio too long (${bio.length} > ${BIO_MAX})`);
  if (!longBio) throw new Error('longBio is empty');
  if (longBio.length > LONG_BIO_MAX) {
    longBio = trimToLongBioLimit(longBio);
  }
  if (longBio.length < LONG_BIO_MIN) throw new Error(`longBio too short (${longBio.length} < ${LONG_BIO_MIN})`);
  if (longBio.length > LONG_BIO_MAX) throw new Error(`longBio too long (${longBio.length} > ${LONG_BIO_MAX})`);

  return { name, title, bio, longBio };
}

function validateGeneratedPayloadLenient(payload: GenerationPayload): LocalizedContent {
  const name = clampSpaces(payload.name ?? '');
  const title = clampSpaces(payload.title ?? '');
  const bio = clampSpaces(payload.bio ?? '');
  const longBio = clampSpaces(payload.longBio ?? '');

  if (!name) throw new Error('name is empty');
  if (!title) throw new Error('title is empty');
  if (!bio) throw new Error('bio is empty');
  if (!longBio) throw new Error('longBio is empty');

  return { name, title, bio, longBio };
}

function trimToLongBioLimit(input: string): string {
  if (input.length <= LONG_BIO_MAX) return input;
  const candidates = ['. ', '! ', '? ', '。', '！', '？', '।', '؛', '…'];
  let best = input.slice(0, LONG_BIO_MAX).trim();
  for (const marker of candidates) {
    const idx = input.lastIndexOf(marker, LONG_BIO_MAX);
    if (idx > LONG_BIO_MIN) {
      const candidate = input.slice(0, idx + marker.length).trim();
      if (candidate.length <= LONG_BIO_MAX && candidate.length >= LONG_BIO_MIN && candidate.length > best.length - 400) {
        best = candidate;
      }
    }
  }
  return best;
}

async function listCharacterTasks(convertedRoot: string, sourceRoot: string): Promise<CharacterTask[]> {
  const sourceEntries = await fs.readdir(sourceRoot, { withFileTypes: true });
  const sourceBySlug = new Map<string, SourceInfo>();
  const sourceByNormSlug = new Map<string, SourceInfo>();
  const sourceByNormName = new Map<string, SourceInfo>();

  for (const entry of sourceEntries) {
    if (!entry.isDirectory()) continue;
    const infoPath = path.join(sourceRoot, entry.name, 'info.json');
    try {
      const source = await readJson<SourceInfo>(infoPath);
      const slug = source.slug ?? '';
      if (slug) sourceBySlug.set(slug, source);
      const normSlug = normalize(slug);
      if (normSlug) sourceByNormSlug.set(normSlug, source);
      const normName = normalize(source.name ?? entry.name);
      if (normName) sourceByNormName.set(normName, source);
    } catch {
      // ignore malformed source info
    }
  }

  const convertedEntries = await fs.readdir(convertedRoot, { withFileTypes: true });
  const tasks: CharacterTask[] = [];

  for (const entry of convertedEntries) {
    if (!entry.isDirectory()) continue;
    const infoPath = path.join(convertedRoot, entry.name, 'info.json');
    try {
      const infoRaw = await readJson<ConvertedInfoFile>(infoPath);
      const info = buildCanonicalInfo(infoRaw);
      const source = sourceBySlug.get(info.slug)
        ?? sourceByNormSlug.get(normalize(info.slug))
        ?? sourceByNormName.get(normalize(pickLocale(info, 'en').name))
        ?? null;

      tasks.push({
        dirName: entry.name,
        infoPath,
        info,
        source,
      });
    } catch {
      // ignore malformed target info
    }
  }

  return tasks.sort((a, b) => a.dirName.localeCompare(b.dirName));
}

function buildEnglishResearchPrompt(task: CharacterTask): string {
  const en = pickLocale(task.info, 'en');
  const sourceLd = task.source?.metadata?.ld_creative_work;
  const sourceMeta = task.source?.metadata?.page_meta;

  const sourceContext = {
    pageUrl: task.source?.page_url ?? null,
    sourceName: task.source?.name ?? null,
    sourceSlug: task.source?.slug ?? null,
    ldDescription: sourceLd?.description ?? null,
    ldKeywords: sourceLd?.keywords ?? null,
    creator: sourceLd?.creator?.name ?? null,
    dateCreated: sourceLd?.dateCreated ?? null,
    genre: sourceLd?.genre ?? null,
    metaTitle: sourceMeta?.title ?? null,
    metaDescription: sourceMeta?.description ?? null,
    metaKeywords: sourceMeta?.keywords ?? null,
  };

  return [
    'You are writing factual metadata for one Brainrot character.',
    'MANDATORY: browse the web to research this exact character before writing.',
    'Use source context as extra hints, not as the only source.',
    'Do not invent facts.',
    'Write the best concise character profile from the facts and context you can verify.',
    'Do NOT write a search-process audit trail. Do not list failed queries, missing catalog entries, websites checked, or phrases like "I could not find", "not confirmed", "not documented", "no reliable sources", or "uncertain".',
    'If exact canonical lore is thin, focus on useful observed context: name meaning/transliteration, visual design from the provided character identity, likely meme/trend context from source hints, and cautious wording without dwelling on absence of information.',
    '',
    `Character JSON: ${JSON.stringify({ slug: task.info.slug, currentName: en.name, currentTitle: en.title })}`,
    `Source context JSON: ${JSON.stringify(sourceContext)}`,
    '',
    'Return STRICT JSON only with this shape:',
    '{"name":"...","title":"...","bio":"...","longBio":"..."}',
    '',
    'Rules:',
    `1) bio max ${BIO_MAX} chars.`,
    `2) longBio ${LONG_BIO_MIN}-${LONG_BIO_MAX} chars.`,
    '3) Write for humans; no fluff, no repetitive filler, no research-log narration.',
    '4) Output language must be English.',
  ].join('\n');
}

function buildTranslationPrompt(options: {
  locale: string;
  localeLabel: string;
  english: LocalizedContent;
  slug: string;
}): string {
  return [
    'You are translating existing English metadata for one character.',
    'Translate only. Do not add new facts and do not browse web.',
    'Keep meaning accurate and natural for native speakers.',
    'Do not summarize. Preserve the full factual detail density from English longBio.',
    'Write as if the text was originally written by a native speaker of the target language.',
    'General terms, actions, and narrative wording must be in the target language; only true proper nouns may stay in original form.',
    'If a name or label can be naturally transliterated/adapted in the target language while preserving recognition, do that.',
    'Maintain readability and flow: avoid mixed-language fragments and avoid literal awkward calques.',
    'Avoid unnatural loanwords from English when a clear native equivalent exists; prioritize idiomatic local wording.',
    '',
    `Target locale code: ${options.locale}`,
    `Target language name: ${options.localeLabel}`,
    `Character slug: ${options.slug}`,
    `English JSON: ${JSON.stringify(options.english)}`,
    '',
    'Return STRICT JSON only with this shape:',
    '{"name":"...","title":"...","bio":"...","longBio":"..."}',
    '',
    'Rules:',
    `1) bio max ${BIO_MAX} chars.`,
    `2) longBio ${LONG_BIO_MIN}-${LONG_BIO_MAX} chars.`,
    '3) Keep tone human-friendly and factual.',
    '4) longBio must be a full-length translation (not a short summary).',
    '5) Translation must read naturally and cohesively end-to-end.',
  ].join('\n');
}

const OLLAMA_TEXT_TRANSLATION_SYSTEM_PROMPT = [
  'You are a translation engine.',
  'Return only the translated text.',
  'Do not output JSON.',
  'Do not add explanations, notes, labels, markdown, code fences, or surrounding quotes.',
  'Keep meaning, facts, names, and numbers accurate.',
  'Keep paragraph breaks.',
  'Use natural native phrasing in the target language.',
  'Forbidden output characters: — and –.',
].join(' ');

function countParagraphs(text: string): number {
  return text.trim().split(/\n\s*\n/).filter(Boolean).length;
}

function normalizeTextModelOutput(raw: string): string {
  const trimmed = raw.trim().replace(/^```[\w-]*\s*/i, '').replace(/```$/i, '').trim();
  const unquoted = trimmed.replace(/^"([\s\S]*)"$/, '$1').trim();
  return unquoted;
}

function buildOllamaFieldPrompt(options: {
  locale: string;
  localeLabel: string;
  field: keyof LocalizedContent;
  text: string;
}): string {
  return [
    `Translate from English to ${options.localeLabel}.`,
    `Target locale code: ${options.locale}.`,
    `Field: ${options.field}.`,
    '',
    options.text,
  ].join('\n');
}

function buildLengthRepairPrompt(options: {
  locale: string;
  localeLabel: string;
  draft: LocalizedContent;
  english?: LocalizedContent;
}): string {
  return [
    'You must repair metadata length only.',
    'Keep the same facts and overall meaning.',
    'Do not add fabricated facts.',
    'Keep style natural and idiomatic for native speakers of the target language.',
    'Avoid mixed-language fragments and avoid unnatural English loanwords when a native equivalent exists.',
    '',
    `Target locale code: ${options.locale}`,
    `Target language name: ${options.localeLabel}`,
    `Current draft JSON: ${JSON.stringify(options.draft)}`,
    options.english ? `English source JSON: ${JSON.stringify(options.english)}` : '',
    '',
    'Return STRICT JSON only with this shape:',
    '{"name":"...","title":"...","bio":"...","longBio":"..."}',
    '',
    'Rules:',
    `1) bio max ${BIO_MAX} chars.`,
    `2) longBio must be ${LONG_BIO_MIN}-${LONG_BIO_MAX} chars.`,
    '3) Preserve facts and structure; expand/compress only as needed to satisfy length limits.',
  ].filter(Boolean).join('\n');
}

function extractFirstJsonObject(raw: string): string {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found in model output.');
  }
  return raw.slice(start, end + 1);
}

function repairJsonControlChars(input: string): string {
  let out = '';
  let inString = false;
  let escape = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    const code = ch.charCodeAt(0);

    if (!inString) {
      out += ch;
      if (ch === '"') inString = true;
      continue;
    }

    if (escape) {
      out += ch;
      escape = false;
      continue;
    }

    if (ch === '\\') {
      out += ch;
      escape = true;
      continue;
    }

    if (ch === '"') {
      out += ch;
      inString = false;
      continue;
    }

    if (code < 0x20) {
      if (ch === '\n') out += '\\n';
      else if (ch === '\r') out += '\\r';
      else if (ch === '\t') out += '\\t';
      else out += `\\u${code.toString(16).padStart(4, '0')}`;
      continue;
    }

    out += ch;
  }

  return out;
}

function parseGenerationPayload(rawModelOutput: string): GenerationPayload {
  const jsonText = extractFirstJsonObject(rawModelOutput);
  try {
    return JSON.parse(jsonText) as GenerationPayload;
  } catch {
    const repaired = repairJsonControlChars(jsonText);
    return JSON.parse(repaired) as GenerationPayload;
  }
}

async function buildCodexOutputPath(tag: string): Promise<string> {
  const safeTag = sanitizeFileTag(tag) || 'task';
  const runDir = path.join(CODEX_OUTPUT_DIR, String(process.pid));
  await fs.mkdir(runDir, { recursive: true });
  return path.join(
    runDir,
    `${safeTag}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`,
  );
}

async function runCodex(
  prompt: string,
  model: string,
  reasoningEffort: ReasoningEffort,
  timeoutMs: number,
  codexCommand: string,
  outputFilePath: string,
): Promise<string> {
  const args = [
    'exec',
    '--model', model,
    '-c', `reasoning_effort="${reasoningEffort}"`,
    '--sandbox', 'read-only',
    '--skip-git-repo-check',
    '--output-last-message', outputFilePath,
    prompt,
  ];

  const shellCommand = `${codexCommand} ${args.map(shellQuote).join(' ')}`.trim();

  await new Promise<void>((resolve, reject) => {
    const child = spawn('zsh', ['-ic', shellCommand], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${codexCommand} timed out after ${formatTimeoutSeconds(timeoutMs)}`));
    }, timeoutMs);

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${codexCommand} exited with code ${code ?? -1}. ${stderr.slice(-1200)}`));
      }
    });
  });

  const raw = await fs.readFile(outputFilePath, 'utf8');
  await fs.rm(outputFilePath, { force: true });
  return raw;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

async function generateValidatedContent(params: {
  prompt: string;
  model: string;
  reasoningEffort: ReasoningEffort;
  timeoutMs: number;
  codexCommand: string;
  outputTag: string;
  locale: string;
  localeLabel: string;
  english?: LocalizedContent;
  strictLengths: boolean;
}): Promise<LocalizedContent> {
  const mainOutputPath = await buildCodexOutputPath(`${params.outputTag}.main`);
  const raw = await runCodex(
    params.prompt,
    params.model,
    params.reasoningEffort,
    params.timeoutMs,
    params.codexCommand,
    mainOutputPath,
  );
  const parsed = parseGenerationPayload(raw);

  try {
    return params.strictLengths
      ? validateGeneratedPayloadStrict(parsed)
      : validateGeneratedPayloadLenient(parsed);
  } catch (error) {
    if (!params.strictLengths) {
      const normalizedDraft = validateGeneratedPayloadLenient(parsed);
      const repairPrompt = buildLengthRepairPrompt({
        locale: params.locale,
        localeLabel: params.localeLabel,
        draft: normalizedDraft,
        english: params.english,
      });
      const repairOutputPath = await buildCodexOutputPath(`${params.outputTag}.repair-lenient`);
      const repairedRaw = await runCodex(
        repairPrompt,
        params.model,
        params.reasoningEffort,
        params.timeoutMs,
        params.codexCommand,
        repairOutputPath,
      );
      const repairedParsed = parseGenerationPayload(repairedRaw);
      return validateGeneratedPayloadLenient(repairedParsed);
    }

    const message = error instanceof Error ? error.message : String(error);
    const canRepairLength = message.includes('longBio too short') || message.includes('longBio too long');
    if (!canRepairLength) throw error;

    const normalizedDraft: LocalizedContent = {
      name: clampSpaces(String(parsed.name ?? '')),
      title: clampSpaces(String(parsed.title ?? '')),
      bio: clampSpaces(String(parsed.bio ?? '')),
      longBio: clampSpaces(String(parsed.longBio ?? '')),
    };

    const repairPrompt = buildLengthRepairPrompt({
      locale: params.locale,
      localeLabel: params.localeLabel,
      draft: normalizedDraft,
      english: params.english,
    });

    const repairOutputPath = await buildCodexOutputPath(`${params.outputTag}.repair-strict`);
    const repairedRaw = await runCodex(
      repairPrompt,
      params.model,
      params.reasoningEffort,
      params.timeoutMs,
      params.codexCommand,
      repairOutputPath,
    );
    const repairedParsed = parseGenerationPayload(repairedRaw);
    return validateGeneratedPayloadStrict(repairedParsed);
  }
}

async function runOllamaTranslateText(params: {
  host: string;
  model: string;
  prompt: string;
  timeoutMs: number;
}): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs);
  const url = `${params.host.replace(/\/+$/, '')}/api/chat`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: params.model,
        stream: false,
        messages: [
          { role: 'system', content: OLLAMA_TEXT_TRANSLATION_SYSTEM_PROMPT },
          { role: 'user', content: params.prompt },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`ollama HTTP ${response.status}`);
    }

    const payload = await response.json() as { error?: string; message?: { content?: string } };
    if (payload.error) {
      throw new Error(`ollama error: ${payload.error}`);
    }

    const content = normalizeTextModelOutput(String(payload.message?.content ?? ''));
    if (!content) {
      throw new Error('ollama returned empty translation text');
    }
    return content;
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      throw new Error(`ollama timed out after ${formatTimeoutSeconds(params.timeoutMs)}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function generateOllamaLocalizedContent(params: {
  locale: string;
  localeLabel: string;
  english: LocalizedContent;
  model: string;
  host: string;
  timeoutMs: number;
}): Promise<{ content: LocalizedContent; report: OllamaTranslationLocaleReport }> {
  const fields: Array<keyof LocalizedContent> = ['name', 'title', 'bio', 'longBio'];
  const out: LocalizedContent = { name: '', title: '', bio: '', longBio: '' };
  const metrics: OllamaTranslationFieldMetric[] = [];
  const startedLocale = performance.now();

  for (const field of fields) {
    const source = String(params.english[field] ?? '');
    const started = performance.now();
    const translated = await runOllamaTranslateText({
      host: params.host,
      model: params.model,
      timeoutMs: params.timeoutMs,
      prompt: buildOllamaFieldPrompt({
        locale: params.locale,
        localeLabel: params.localeLabel,
        field,
        text: source,
      }),
    });
    out[field] = translated;

    metrics.push({
      field,
      sourceChars: source.length,
      translatedChars: translated.length,
      durationSeconds: Math.round((performance.now() - started) / 10) / 100,
      checks: {
        empty: translated.trim().length === 0,
        sameAsSource: translated.trim() === source.trim(),
        hasLongDash: /[—–]/.test(translated),
        paragraphMismatch: countParagraphs(source) !== countParagraphs(translated),
      },
    });
  }

  return {
    content: validateGeneratedPayloadLenient(out),
    report: {
      locale: params.locale,
      localeLabel: params.localeLabel,
      model: params.model,
      totalDurationSeconds: Math.round((performance.now() - startedLocale) / 10) / 100,
      fields: metrics,
    },
  };
}

async function runWithRetries<T>(params: {
  maxRetries: number;
  label: string;
  logsDir: string;
  exec: () => Promise<T>;
}): Promise<T> {
  let lastError = 'Unknown error';
  for (let attempt = 1; attempt <= params.maxRetries + 1; attempt += 1) {
    try {
      return await params.exec();
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      const failPath = path.join(params.logsDir, `${params.label}.attempt-${attempt}.error.log`);
      await fs.writeFile(failPath, lastError, 'utf8');
    }
  }
  throw new Error(lastError);
}

async function runTranslationWithRetries(params: {
  charSlug: string;
  logTag: string;
  locale: string;
  localeLabel: string;
  english: LocalizedContent;
  maxRetries: number;
  timeoutMs: number;
  label: string;
  logsDir: string;
  runtime: TranslationRuntimeController;
  backend: TranslationBackend;
  codexCommand: string;
  prompt?: string;
  ollamaHost: string;
  localeReportSink?: OllamaTranslationLocaleReport[];
}): Promise<LocalizedContent> {
  let lastError = 'Unknown error';
  const totalAttempts = params.maxRetries + 1;

  for (let attempt = 1; attempt <= params.maxRetries + 1; attempt += 1) {
    const runtimeConfig = params.runtime.getCurrent();
    console.log(
      `[${params.logTag}] translate:${params.locale} (${params.localeLabel}) attempt ${attempt}/${totalAttempts} model=${runtimeConfig.model} reasoning=${runtimeConfig.reasoning}`,
    );

    try {
      let translated: LocalizedContent;
      if (params.backend === 'ollama') {
        const result = await generateOllamaLocalizedContent({
          locale: params.locale,
          localeLabel: params.localeLabel,
          english: params.english,
          model: runtimeConfig.model,
          host: params.ollamaHost,
          timeoutMs: params.timeoutMs,
        });
        translated = result.content;
        if (params.localeReportSink) params.localeReportSink.push(result.report);
      } else {
        translated = await generateValidatedContent({
          prompt: params.prompt ?? '',
          model: runtimeConfig.model,
          reasoningEffort: runtimeConfig.reasoning,
          timeoutMs: params.timeoutMs,
          codexCommand: params.codexCommand,
          outputTag: `${params.charSlug}.${params.locale}.attempt-${attempt}`,
          locale: params.locale,
          localeLabel: params.localeLabel,
          english: params.english,
          strictLengths: false,
        });
      }
      console.log(
        `[${params.logTag}] translate:${params.locale} done (model=${runtimeConfig.model})`,
      );
      return translated;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      const failPath = path.join(params.logsDir, `${params.label}.attempt-${attempt}.error.log`);
      await fs.writeFile(failPath, `${lastError}\nmodel=${runtimeConfig.model}\nreasoning=${runtimeConfig.reasoning}\n`, 'utf8');
      console.log(
        `[${params.logTag}] translate:${params.locale} attempt ${attempt}/${totalAttempts} failed: ${lastError}`,
      );

      if (
        params.backend === 'codex'
        && params.runtime.failoverEnabled
        && params.runtime.shouldFallback(error)
        && runtimeConfig.model !== params.runtime.fallbackModel
      ) {
        params.runtime.activateFallback();
      }
    }
  }

  throw new Error(lastError);
}

async function runPool<T>(items: T[], worker: (item: T, index: number) => Promise<void>, concurrency: number): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const idx = cursor;
      cursor += 1;
      if (idx >= items.length) return;
      await worker(items[idx], idx);
    }
  });
  await Promise.all(workers);
}

function getLocaleLabel(code: string): string {
  const map: Record<string, string> = {
    en: 'English',
    es: 'Spanish',
    hi: 'Hindi',
    zh: 'Chinese',
    th: 'Thai',
    ko: 'Korean',
    ja: 'Japanese',
    de: 'German',
    pl: 'Polish',
    fr: 'French',
    it: 'Italian',
    nl: 'Dutch',
    tr: 'Turkish',
    id: 'Indonesian',
    ar: 'Arabic',
    vi: 'Vietnamese',
    fa: 'Persian',
    ru: 'Russian',
    pt: 'Portuguese',
    ur: 'Urdu',
    bn: 'Bengali',
    am: 'Amharic',
    fil: 'Filipino',
    uk: 'Ukrainian',
  };
  return map[code] ?? code;
}

async function processCharacter(
  task: CharacterTask,
  options: RunOptions,
  logsDir: string,
  translationRuntime: TranslationRuntimeController,
  saveCoordinator: LocaleSaveCoordinator,
  progressTag: string,
  localeReportSink?: OllamaTranslationLocaleReport[],
): Promise<{ changed: boolean; enGenerated: boolean; translatedCount: number }> {
  let changed = false;
  let enGenerated = false;
  let translatedCount = 0;

  const canonical = await readCanonicalInfoFile(task.infoPath);
  let english = pickLocale(canonical, 'en');

  if (!isCompleteLocale(english)) {
    console.log(
      `[${progressTag}] research:en start model=${options.researchModel} reasoning=${options.researchReasoning}`,
    );
    const prompt = buildEnglishResearchPrompt({ ...task, info: canonical });
    const generated = await runWithRetries<LocalizedContent>({
      maxRetries: options.maxRetries,
      label: `${task.info.slug}.en`,
      logsDir,
      exec: async () => generateValidatedContent({
        prompt,
        model: options.researchModel,
        reasoningEffort: options.researchReasoning,
        timeoutMs: options.researchTimeoutMs,
        codexCommand: options.codexCommand,
        outputTag: `${task.info.slug}.en`,
        locale: 'en',
        localeLabel: 'English',
        strictLengths: true,
      }),
    });

    canonical.locales = canonical.locales || {};
    canonical.locales.en = generated;
    english = generated;
    enGenerated = true;
    const saved = await saveCoordinator.enqueue({
      infoPath: task.infoPath,
      charSlug: task.info.slug,
      logTag: progressTag,
      locale: 'en',
      content: generated,
      source: 'research',
    });
    if (saved === 'written' || saved === 'simulated') {
      console.log(`[${progressTag}] saved:en (research)`);
      changed = changed || saved === 'written';
    } else {
      console.log(`[${progressTag}] save-skip:en (already complete on disk)`);
      const latest = await readCanonicalInfoFile(task.infoPath);
      english = pickLocale(latest, 'en');
    }
    console.log(`[${progressTag}] research:en done`);
  } else {
    console.log(`[${progressTag}] research:en skipped (already filled)`);
  }

  const targetLocales = options.targetLocales.filter((code) => code !== 'en');
  const missingLocales = targetLocales.filter((code) => {
    const existing = pickLocale(canonical, code);
    return !isCompleteLocale(existing);
  });

  if (missingLocales.length > 0) {
    console.log(
      `[${progressTag}] translations pending: ${missingLocales.join(', ')}`,
    );
    await runPool(missingLocales, async (locale) => {
      const alreadyComplete = await isLocaleCompleteOnDisk(task.infoPath, locale);
      if (alreadyComplete) {
        console.log(`[${progressTag}] translate:${locale} skipped (already complete on disk)`);
        return;
      }

      const prompt = options.translationBackend === 'codex'
        ? buildTranslationPrompt({
          locale,
          localeLabel: getLocaleLabel(locale),
          english,
          slug: canonical.slug,
        })
        : undefined;

      const translated = await runTranslationWithRetries({
        charSlug: task.info.slug,
        logTag: progressTag,
        locale,
        localeLabel: getLocaleLabel(locale),
        english,
        maxRetries: options.maxRetries,
        timeoutMs: options.translationTimeoutMs,
        label: `${task.info.slug}.${locale}`,
        logsDir,
        runtime: translationRuntime,
        backend: options.translationBackend,
        codexCommand: options.codexCommand,
        prompt,
        ollamaHost: options.ollamaHost,
        localeReportSink,
      });

      const saved = await saveCoordinator.enqueue({
        infoPath: task.infoPath,
        charSlug: task.info.slug,
        logTag: progressTag,
        locale,
        content: translated,
        source: 'translation',
      });

      if (saved === 'written' || saved === 'simulated') {
        translatedCount += 1;
        changed = changed || saved === 'written';
        console.log(saved === 'written'
          ? `[${progressTag}] saved:${locale} (translation)`
          : `[${progressTag}] save-simulated:${locale} (translation)`);
      } else {
        console.log(`[${progressTag}] save-skip:${locale} (already complete on disk)`);
      }
    }, options.languageConcurrency);
  } else {
    console.log(`[${progressTag}] translations skipped (all target locales already filled)`);
  }

  return { changed, enGenerated, translatedCount };
}

async function runSingleInfoMode(
  options: RunOptions,
  logsDir: string,
  translationRuntime: TranslationRuntimeController,
): Promise<void> {
  const inputPath = options.inputInfoPath;
  if (!inputPath) return;

  const infoRaw = await readJson<ConvertedInfoFile>(inputPath);
  const canonical = buildCanonicalInfo(infoRaw);
  if (!canonical.slug) {
    canonical.slug = path.basename(path.dirname(inputPath)) || path.basename(inputPath, path.extname(inputPath));
  }

  const english = pickLocale(canonical, 'en');
  if (!isCompleteLocale(english)) {
    throw new Error('Single-file mode requires complete English locale in input info.json.');
  }

  const localeReports: OllamaTranslationLocaleReport[] = [];
  const targetLocales = options.targetLocales.filter((code) => code !== 'en');

  console.log(`Single-file mode: ${inputPath}`);
  console.log(`Slug: ${canonical.slug}`);
  console.log(`Locales to translate: ${targetLocales.join(', ')}`);

  const merged = buildCanonicalInfo(canonical);

  await runPool(targetLocales, async (locale, idx) => {
    const localeLabel = getLocaleLabel(locale);
    const tag = `${idx + 1}/${targetLocales.length} - ${canonical.slug}`;
    const translated = await runTranslationWithRetries({
      charSlug: canonical.slug,
      logTag: tag,
      locale,
      localeLabel,
      english,
      maxRetries: options.maxRetries,
      timeoutMs: options.translationTimeoutMs,
      label: `${canonical.slug}.${locale}`,
      logsDir,
      runtime: translationRuntime,
      backend: options.translationBackend,
      codexCommand: options.codexCommand,
      prompt: options.translationBackend === 'codex'
        ? buildTranslationPrompt({
          locale,
          localeLabel,
          english,
          slug: canonical.slug,
        })
        : undefined,
      ollamaHost: options.ollamaHost,
      localeReportSink: localeReports,
    });
    merged.locales = merged.locales || {};
    merged.locales[locale] = translated;
    console.log(`[${idx + 1}/${targetLocales.length}] translated ${locale}`);
  }, options.languageConcurrency);

  const outputInfoPath = options.outputInfoPath
    ?? path.resolve(path.join(os.tmpdir(), `${sanitizeFileTag(canonical.slug)}.translated.preview.json`));
  await writeJsonAtomic(outputInfoPath, merged);
  console.log(`Preview output: ${outputInfoPath}`);

  if (!options.noWrite) {
    await writeJsonAtomic(inputPath, merged);
    console.log(`Updated input file: ${inputPath}`);
  } else {
    console.log('Input file update skipped (--no-write).');
  }

  if (options.qualityReportPath) {
    const summary = {
      generatedAt: new Date().toISOString(),
      inputInfoPath: inputPath,
      outputInfoPath,
      backend: options.translationBackend,
      model: translationRuntime.getCurrent().model,
      localeCount: localeReports.length,
      totalDurationSeconds: Math.round(localeReports.reduce((sum, row) => sum + row.totalDurationSeconds, 0) * 100) / 100,
      checks: {
        empty: localeReports.flatMap((row) => row.fields).filter((row) => row.checks.empty).length,
        sameAsSource: localeReports.flatMap((row) => row.fields).filter((row) => row.checks.sameAsSource).length,
        hasLongDash: localeReports.flatMap((row) => row.fields).filter((row) => row.checks.hasLongDash).length,
        paragraphMismatch: localeReports.flatMap((row) => row.fields).filter((row) => row.checks.paragraphMismatch).length,
      },
      locales: localeReports,
    };
    await writeJsonAtomic(options.qualityReportPath, summary);
    console.log(`Quality report: ${options.qualityReportPath}`);
  }
}

async function main(): Promise<void> {
  const options = parseArgs();
  const translationRuntime = createTranslationRuntimeController(options);
  const saveCoordinator = createLocaleSaveCoordinator(options.noWrite);
  const logsDir = path.resolve('scripts/tmp/.bio-fill-logs');
  await fs.mkdir(logsDir, { recursive: true });

  if (options.inputInfoPath) {
    await runSingleInfoMode(options, logsDir, translationRuntime);
    return;
  }

  const allTasks = await listCharacterTasks(options.convertedRoot, options.sourceRoot);
  const scoped = options.onlySlugs
    ? allTasks.filter((task) => options.onlySlugs?.has(task.info.slug))
    : allTasks;

  const pending = scoped.filter((task) => {
    const canonical = buildCanonicalInfo(task.info);
    const english = pickLocale(canonical, 'en');
    if (!isCompleteLocale(english)) return true;

    return options.targetLocales
      .filter((code) => code !== 'en')
      .some((code) => !isCompleteLocale(pickLocale(canonical, code)));
  });

  const queue = pending.slice(0, options.limit);

  console.log(`Total converted characters: ${allTasks.length}`);
  console.log(`Pending (need EN and/or translations): ${pending.length}`);
  console.log(`Will process now: ${queue.length}`);
  console.log(`Character concurrency: ${options.characterConcurrency}`);
  console.log(`Language concurrency: ${options.languageConcurrency}`);
  console.log(`Research model/reasoning: ${options.researchModel} / ${options.researchReasoning}`);
  if (options.translationBackend === 'ollama') {
    console.log(`Translation backend/model: ollama / ${options.ollamaModel}`);
    console.log(`Ollama host: ${options.ollamaHost}`);
  } else {
    console.log(`Codex command: ${options.codexCommand} (via zsh -ic)`);
    console.log(`Translation model/reasoning: ${options.translationModel} / ${options.translationReasoning}`);
  }
  if (!translationRuntime.failoverEnabled || options.translationBackend === 'ollama') {
    console.log('Translation failover: disabled (explicit --translation-model/--model provided)');
  } else {
    console.log(`Translation failover: enabled (${DEFAULT_TRANSLATION_FALLBACK_MODEL} / ${DEFAULT_TRANSLATION_FALLBACK_REASONING}, reset 1h)`);
  }
  console.log(`Research timeout: ${formatTimeoutSeconds(options.researchTimeoutMs)}`);
  console.log(`Translation timeout: ${formatTimeoutSeconds(options.translationTimeoutMs)}`);
  console.log(`Target locales: ${options.targetLocales.join(', ')}`);
  if (options.noWrite) {
    console.log('Write mode: disabled (--no-write)');
  }

  const results: Array<{ slug: string; ok: boolean; message: string }> = [];

  await runPool(queue, async (task, idx) => {
    const pos = idx + 1;
    const progressTag = `${pos}/${queue.length} - ${task.info.slug}`;
    try {
      console.log(`[${pos}/${queue.length}] Start ${task.info.slug}`);
      const result = await processCharacter(task, options, logsDir, translationRuntime, saveCoordinator, progressTag);
      const message = [
        result.enGenerated ? 'en:generated' : 'en:skipped',
        `translated:${result.translatedCount}`,
        result.changed ? 'written' : 'unchanged',
      ].join(' | ');
      console.log(`[${pos}/${queue.length}] Done ${task.info.slug}: ${message}`);
      results.push({ slug: task.info.slug, ok: true, message });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`[${pos}/${queue.length}] Fail ${task.info.slug}: ${msg}`);
      results.push({ slug: task.info.slug, ok: false, message: msg });
    }
  }, options.characterConcurrency);

  const ok = results.filter((entry) => entry.ok).length;
  const failed = results.length - ok;

  console.log('\n=== Summary ===');
  console.log(`Success: ${ok}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    for (const row of results.filter((entry) => !entry.ok)) {
      console.log(`- ${row.slug}: ${row.message}`);
    }
    process.exitCode = 1;
  }
}

const isDirectExecution = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(entry) === path.resolve(fileURLToPath(import.meta.url));
})();

if (isDirectExecution) {
  void main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export {
  countParagraphs,
  normalizeTextModelOutput,
  buildOllamaFieldPrompt,
  buildCanonicalInfo,
  pickLocale,
  isCompleteLocale,
  createLocaleSaveCoordinator,
};
