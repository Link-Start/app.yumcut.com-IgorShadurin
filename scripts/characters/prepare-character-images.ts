#!/usr/bin/env tsx
import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';

type CliOptions = {
  source: string;
  category: string;
  publicRoot: string;
  manifestPath: string;
  metaTemplatePath: string;
  clean: boolean;
  socialOnly: boolean;
};

type ImageVariant = {
  key: 'card' | 'profile' | 'app';
  width: number;
  height: number;
  quality: number;
  note: string;
};

type SocialCardVariant = {
  key: 'og' | 'x' | 'linkedin' | 'square';
  width: number;
  height: number;
  quality: number;
  subjectHeightRatio: number;
  targets: string[];
  note: string;
};

type CharacterManifestRow = {
  id: string;
  sourceDir: string;
  originalPreparedUrl: string;
  originalEmptyUrl: string | null;
  variants: Record<ImageVariant['key'], {
    url: string;
    width: number;
    height: number;
    format: 'webp';
  }>;
  socialCards: Record<SocialCardVariant['key'], {
    url: string;
    width: number;
    height: number;
    format: 'jpg';
    targets: string[];
  }>;
};

type CategoryManifest = {
  category: string;
  generatedAt: string;
  source: string;
  metaTemplateUrl: string;
  variants: Record<ImageVariant['key'], { width: number; height: number; format: 'webp'; note: string }>;
  socialVariants: Record<SocialCardVariant['key'], {
    width: number;
    height: number;
    format: 'jpg';
    quality: number;
    subjectHeightRatio: number;
    targets: string[];
    note: string;
  }>;
  characters: CharacterManifestRow[];
};

type CharacterSource = {
  sourceDir: string;
  idSeed: string;
};

const IMAGE_VARIANTS: ImageVariant[] = [
  {
    key: 'card',
    width: 270,
    height: 480,
    quality: 76,
    note: 'Lightweight 9:16 card for category/character grids on web and mobile browser.',
  },
  {
    key: 'profile',
    width: 405,
    height: 720,
    quality: 80,
    note: 'Medium 9:16 preview for profile pages and in-app character selection.',
  },
  {
    key: 'app',
    width: 810,
    height: 1440,
    quality: 84,
    note: 'High-density 9:16 preview for iOS/Android apps and retina displays.',
  },
];

// Sizes based on platform docs:
// - X summary_large_image: 2:1, min 300x157, max 4096x4096, <=5MB
// - LinkedIn share frame: 1.91:1, 1200x627
// - OGP is used broadly by FB/WhatsApp/Telegram/Discord/Slack previews.
const SOCIAL_CARD_VARIANTS: SocialCardVariant[] = [
  {
    key: 'og',
    width: 1200,
    height: 630,
    quality: 82,
    subjectHeightRatio: 0.86,
    targets: ['Facebook', 'WhatsApp', 'Telegram', 'Discord', 'Slack', 'Generic Open Graph'],
    note: 'Universal Open Graph 1.91:1 card for most social/messenger link previews.',
  },
  {
    key: 'x',
    width: 1200,
    height: 600,
    quality: 82,
    subjectHeightRatio: 0.86,
    targets: ['X (summary_large_image)'],
    note: 'X summary_large_image optimized 2:1 card.',
  },
  {
    key: 'linkedin',
    width: 1200,
    height: 627,
    quality: 82,
    subjectHeightRatio: 0.86,
    targets: ['LinkedIn'],
    note: 'LinkedIn sharing frame ratio 1.91:1 (1200x627).',
  },
  {
    key: 'square',
    width: 1200,
    height: 1200,
    quality: 80,
    subjectHeightRatio: 0.86,
    targets: ['Square fallback crops / previews'],
    note: 'Square card for clients that aggressively crop or favor square thumbnails.',
  },
];

const DEFAULT_META_TEMPLATE = path.resolve('scripts/characters/assets/social-meta-template.png');
const ACCEPTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

function printUsage(message?: string): never {
  if (message) {
    console.error(`Error: ${message}`);
  }
  console.log(`\nUsage: npm run characters:prepare -- --source <dir> --category <slug> [--public-root public/characters] [--manifest <path>] [--meta-template <path>] [--clean] [--social-only]\n\nExample:\n  npm run characters:prepare -- \\
    --source /Users/test/Downloads/characters/iBrainrot \\
    --category ibrainrot \\
    --meta-template scripts/characters/assets/social-meta-template.png \\
    --clean\n`);
  process.exit(message ? 1 : 0);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'character';
}

function parseArgs(argv: string[]): CliOptions {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
  }

  let source = '';
  let category = '';
  let publicRoot = 'public/characters';
  let manifestPath = '';
  let metaTemplatePath = DEFAULT_META_TEMPLATE;
  let clean = false;
  let socialOnly = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--clean') {
      clean = true;
      continue;
    }
    if (arg === '--social-only') {
      socialOnly = true;
      continue;
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

    if (key === 'source') source = next;
    else if (key === 'category') category = slugify(next);
    else if (key === 'public-root') publicRoot = next;
    else if (key === 'manifest') manifestPath = next;
    else if (key === 'meta-template') metaTemplatePath = next;
    else printUsage(`Unknown option: --${key}`);
  }

  if (!source) printUsage('Missing required --source');
  if (!category) printUsage('Missing required --category');
  if (clean && socialOnly) {
    printUsage('--clean cannot be used together with --social-only');
  }

  const resolvedRoot = path.resolve(publicRoot);
  const defaultManifest = path.join(resolvedRoot, category, 'manifest.json');

  return {
    source: path.resolve(source),
    category,
    publicRoot: resolvedRoot,
    manifestPath: manifestPath ? path.resolve(manifestPath) : defaultManifest,
    metaTemplatePath: path.resolve(metaTemplatePath),
    clean,
    socialOnly,
  };
}

async function ensureDirectory(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findNamedImage(directory: string, nameWithoutExtension: string): Promise<string | null> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!ACCEPTED_EXTENSIONS.has(ext)) continue;
    const parsed = path.parse(entry.name);
    if (parsed.name.toLowerCase() === nameWithoutExtension.toLowerCase()) {
      return path.join(directory, entry.name);
    }
  }
  return null;
}

function toOutputReference(absPath: string): string {
  const publicRoot = path.resolve('public');
  const normalized = path.resolve(absPath);
  if (normalized === publicRoot || normalized.startsWith(`${publicRoot}${path.sep}`)) {
    const rel = path.relative(publicRoot, normalized);
    return `/${rel.split(path.sep).join('/')}`;
  }
  return normalized;
}

async function createHighQualityWebp(sourceFile: string, targetFile: string): Promise<void> {
  await ensureDirectory(path.dirname(targetFile));
  await sharp(sourceFile)
    .rotate()
    .webp({
      quality: 95,
      effort: 6,
      smartSubsample: true,
    })
    .toFile(targetFile);
}

async function createVariant(sourceFile: string, targetFile: string, variant: ImageVariant): Promise<void> {
  await ensureDirectory(path.dirname(targetFile));
  await sharp(sourceFile)
    .rotate()
    .resize(variant.width, variant.height, {
      fit: 'cover',
      position: 'center',
      withoutEnlargement: true,
    })
    .webp({ quality: variant.quality })
    .toFile(targetFile);
}

async function buildSubjectBuffer(sourceFile: string, targetWidth: number, targetHeight: number): Promise<Buffer> {
  // Remove white/near-white background so empty.png style assets stay clean on dark templates.
  const { data, info } = await sharp(sourceFile)
    .rotate()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixel = info.channels;
  for (let i = 0; i < data.length; i += pixel) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const a = data[i + 3] ?? 255;
    if (a === 0) continue;

    const minRgb = Math.min(r, g, b);
    if (minRgb >= 250) {
      data[i + 3] = 0;
      continue;
    }

    if (minRgb >= 235) {
      const blend = (250 - minRgb) / 15;
      data[i + 3] = Math.max(0, Math.min(255, Math.round(a * blend)));
    }
  }

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .trim()
    .resize({
      width: targetWidth,
      height: targetHeight,
      fit: 'inside',
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();
}

async function createSocialCard(
  subjectSourceFile: string,
  templateFile: string,
  targetFile: string,
  variant: SocialCardVariant,
): Promise<void> {
  await ensureDirectory(path.dirname(targetFile));
  const targetHeight = Math.max(1, Math.round(variant.height * variant.subjectHeightRatio));
  const targetWidth = variant.width;
  const [subjectBuffer, templateBuffer] = await Promise.all([
    buildSubjectBuffer(subjectSourceFile, targetWidth, targetHeight),
    sharp(templateFile)
      .rotate()
      .resize(variant.width, variant.height, {
        fit: 'cover',
        position: 'center',
        withoutEnlargement: false,
      })
      .toBuffer(),
  ]);

  await sharp(templateBuffer)
    .composite([{ input: subjectBuffer, gravity: 'center' }])
    .jpeg({
      quality: variant.quality,
      mozjpeg: true,
      progressive: true,
      chromaSubsampling: '4:2:0',
    })
    .toFile(targetFile);
}

async function createSocialCardWhite(
  subjectSourceFile: string,
  targetFile: string,
  variant: SocialCardVariant,
): Promise<void> {
  await ensureDirectory(path.dirname(targetFile));
  const targetHeight = Math.max(1, Math.round(variant.height * variant.subjectHeightRatio));
  const targetWidth = variant.width;
  const subjectBuffer = await buildSubjectBuffer(subjectSourceFile, targetWidth, targetHeight);

  await sharp({
    create: {
      width: variant.width,
      height: variant.height,
      channels: 3,
      background: '#ffffff',
    },
  })
    .composite([{ input: subjectBuffer, gravity: 'center' }])
    .jpeg({
      quality: variant.quality,
      mozjpeg: true,
      progressive: true,
      chromaSubsampling: '4:2:0',
    })
    .toFile(targetFile);
}

async function resolveCharacterSources(sourceRoot: string): Promise<CharacterSource[]> {
  const rootPrepared = await findNamedImage(sourceRoot, 'prepared');
  if (rootPrepared) {
    return [{
      sourceDir: sourceRoot,
      idSeed: path.basename(sourceRoot),
    }];
  }

  const sourceEntries = await fs.readdir(sourceRoot, { withFileTypes: true });
  const characterDirs = sourceEntries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  return characterDirs.map((directoryName) => ({
    sourceDir: path.join(sourceRoot, directoryName),
    idSeed: directoryName,
  }));
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv);

  const sourceExists = await fileExists(options.source);
  if (!sourceExists) {
    throw new Error(`Source directory does not exist: ${options.source}`);
  }
  if (!options.socialOnly) {
    const templateExists = await fileExists(options.metaTemplatePath);
    if (!templateExists) {
      throw new Error(`Meta template image does not exist: ${options.metaTemplatePath}`);
    }
  }

  const categoryOutputDir = path.join(options.publicRoot, options.category);
  if (options.clean) {
    await fs.rm(categoryOutputDir, { recursive: true, force: true });
  }
  await ensureDirectory(categoryOutputDir);

  const characterSources = await resolveCharacterSources(options.source);
  if (characterSources.length === 0) {
    throw new Error(`No character sources found in: ${options.source}`);
  }

  const manifestRows: CharacterManifestRow[] = [];

  for (const characterSource of characterSources) {
    const sourceDir = characterSource.sourceDir;
    const characterId = slugify(characterSource.idSeed);

    const preparedPath = await findNamedImage(sourceDir, 'prepared');
    if (!preparedPath) {
      throw new Error(`Missing prepared image in ${sourceDir} (expected prepared.png/jpg/jpeg/webp)`);
    }
    const emptyPath = await findNamedImage(sourceDir, 'empty');

    const targetCharacterDir = path.join(categoryOutputDir, characterId);
    const targetOriginalsDir = path.join(targetCharacterDir, 'original');
    const targetPreviewsDir = path.join(targetCharacterDir, 'preview');
    const targetSocialDir = path.join(targetCharacterDir, 'social');

    if (options.socialOnly) {
      await fs.rm(targetSocialDir, { recursive: true, force: true });
      await ensureDirectory(targetSocialDir);
      const subjectSource = emptyPath ?? preparedPath;
      for (const socialVariant of SOCIAL_CARD_VARIANTS) {
        const socialPath = path.join(targetSocialDir, `${socialVariant.key}.jpg`);
        await createSocialCardWhite(subjectSource, socialPath, socialVariant);
      }
      continue;
    }

    const preparedTarget = path.join(targetOriginalsDir, 'prepared.webp');
    await createHighQualityWebp(preparedPath, preparedTarget);

    let emptyTarget: string | null = null;
    if (emptyPath) {
      emptyTarget = path.join(targetOriginalsDir, 'empty.webp');
      await createHighQualityWebp(emptyPath, emptyTarget);
    }

    const variants: CharacterManifestRow['variants'] = {
      card: { url: '', width: 0, height: 0, format: 'webp' },
      profile: { url: '', width: 0, height: 0, format: 'webp' },
      app: { url: '', width: 0, height: 0, format: 'webp' },
    };

    for (const variant of IMAGE_VARIANTS) {
      const variantPath = path.join(targetPreviewsDir, `${variant.key}.webp`);
      await createVariant(preparedPath, variantPath, variant);
      variants[variant.key] = {
        url: toOutputReference(variantPath),
        width: variant.width,
        height: variant.height,
        format: 'webp',
      };
    }

    const socialCards: CharacterManifestRow['socialCards'] = {
      og: { url: '', width: 0, height: 0, format: 'jpg', targets: [] },
      x: { url: '', width: 0, height: 0, format: 'jpg', targets: [] },
      linkedin: { url: '', width: 0, height: 0, format: 'jpg', targets: [] },
      square: { url: '', width: 0, height: 0, format: 'jpg', targets: [] },
    };

    const subjectSource = emptyPath ?? preparedPath;
    for (const socialVariant of SOCIAL_CARD_VARIANTS) {
      const socialPath = path.join(targetSocialDir, `${socialVariant.key}.jpg`);
      await createSocialCard(subjectSource, options.metaTemplatePath, socialPath, socialVariant);
      socialCards[socialVariant.key] = {
        url: toOutputReference(socialPath),
        width: socialVariant.width,
        height: socialVariant.height,
        format: 'jpg',
        targets: [...socialVariant.targets],
      };
    }

    manifestRows.push({
      id: characterId,
      sourceDir: path.relative(options.source, sourceDir) || '.',
      originalPreparedUrl: toOutputReference(preparedTarget),
      originalEmptyUrl: emptyTarget ? toOutputReference(emptyTarget) : null,
      variants,
      socialCards,
    });
  }

  if (options.socialOnly) {
    console.log(`Regenerated social cards (white background) for ${characterSources.length} character(s) in category: ${options.category}`);
    console.log(`Output: ${categoryOutputDir}`);
    return;
  }

  const manifest: CategoryManifest = {
    category: options.category,
    generatedAt: new Date().toISOString(),
    source: options.source,
    metaTemplateUrl: toOutputReference(options.metaTemplatePath),
    variants: Object.fromEntries(
      IMAGE_VARIANTS.map((variant) => [
        variant.key,
        {
          width: variant.width,
          height: variant.height,
          format: 'webp',
          note: variant.note,
        },
      ]),
    ) as CategoryManifest['variants'],
    socialVariants: Object.fromEntries(
      SOCIAL_CARD_VARIANTS.map((variant) => [
        variant.key,
        {
          width: variant.width,
          height: variant.height,
          format: 'jpg',
          quality: variant.quality,
          subjectHeightRatio: variant.subjectHeightRatio,
          targets: [...variant.targets],
          note: variant.note,
        },
      ]),
    ) as CategoryManifest['socialVariants'],
    characters: manifestRows,
  };

  await ensureDirectory(path.dirname(options.manifestPath));
  await fs.writeFile(options.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(`Prepared ${manifestRows.length} character(s) in category: ${options.category}`);
  console.log(`Output: ${categoryOutputDir}`);
  console.log(`Manifest: ${options.manifestPath}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
