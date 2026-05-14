import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';
import { prisma } from '@/server/db';
import { guessStorageContentType, uploadCharacterAssetToStorage } from '@/server/storage';

type AssetRef =
  | { kind: 'previewVideo'; characterId: string; value: string | null }
  | { kind: 'preparedImage'; variationId: string; value: string | null }
  | { kind: 'emptyImage'; variationId: string; value: string | null };

export function resolveLocalPublicCharacterAssetPath(value: string | null | undefined, publicCharactersRoot = path.resolve('public/characters')): string | null {
  if (!value) return null;
  let normalized = value.trim();
  if (!normalized || /^https?:\/\//i.test(normalized) || normalized.startsWith('//')) return null;
  if (normalized.startsWith('/api/media/')) return null;
  normalized = normalized.replace(/^\/+/, '');
  if (normalized.startsWith('public/')) normalized = normalized.slice('public/'.length);
  if (!normalized.startsWith('characters/')) return null;
  const relative = normalized.slice('characters/'.length);
  const segments = relative.split(/[\\/]+/).filter(Boolean);
  if (!segments.length || segments.some((segment) => segment === '.' || segment === '..')) return null;
  const resolved = path.resolve(publicCharactersRoot, ...segments);
  const root = path.resolve(publicCharactersRoot);
  const rootRelative = path.relative(root, resolved);
  if (rootRelative.startsWith('..') || path.isAbsolute(rootRelative)) return null;
  return resolved;
}

function parseArgs(argv: string[]) {
  return {
    apply: argv.includes('--apply'),
    publicCharactersRoot: (() => {
      const index = argv.indexOf('--public-root');
      return index >= 0 && argv[index + 1] ? path.resolve(argv[index + 1]) : path.resolve('public/characters');
    })(),
  };
}

function fileNameForRef(ref: AssetRef, localPath: string) {
  const ext = path.extname(localPath) || (ref.kind === 'previewVideo' ? '.mp4' : '.webp');
  const base = ref.kind === 'previewVideo'
    ? `catalog-${ref.characterId}-preview`
    : `catalog-${ref.variationId}-${ref.kind === 'preparedImage' ? 'prepared' : 'empty'}`;
  return `${base}${ext}`;
}

async function collectAssetRefs(): Promise<AssetRef[]> {
  const characters = await prisma.character.findMany({
    select: {
      id: true,
      previewVideoUrl: true,
      variations: {
        select: {
          id: true,
          imagePath: true,
          emptyImagePath: true,
        },
      },
    },
  });

  return characters.flatMap((character) => [
    { kind: 'previewVideo' as const, characterId: character.id, value: character.previewVideoUrl },
    ...character.variations.flatMap((variation) => [
      { kind: 'preparedImage' as const, variationId: variation.id, value: variation.imagePath },
      { kind: 'emptyImage' as const, variationId: variation.id, value: variation.emptyImagePath },
    ]),
  ]);
}

async function updateRef(ref: AssetRef, nextPath: string) {
  if (ref.kind === 'previewVideo') {
    await prisma.character.update({ where: { id: ref.characterId }, data: { previewVideoUrl: nextPath } });
    return;
  }
  await prisma.characterVariation.update({
    where: { id: ref.variationId },
    data: ref.kind === 'preparedImage' ? { imagePath: nextPath } : { emptyImagePath: nextPath },
  });
}

export async function migrateCharacterAssetsToStorage(options: { apply: boolean; publicCharactersRoot?: string }) {
  const refs = await collectAssetRefs();
  const planned: Array<{ ref: AssetRef; localPath: string }> = [];
  const missing: Array<{ ref: AssetRef; localPath: string }> = [];

  for (const ref of refs) {
    const localPath = resolveLocalPublicCharacterAssetPath(ref.value, options.publicCharactersRoot);
    if (!localPath) continue;
    try {
      const stat = await fs.stat(localPath);
      if (!stat.isFile()) {
        missing.push({ ref, localPath });
        continue;
      }
      planned.push({ ref, localPath });
    } catch {
      missing.push({ ref, localPath });
    }
  }

  console.log(`Found ${planned.length} local character asset(s) to migrate.`);
  if (missing.length > 0) {
    console.warn(`Missing ${missing.length} local character asset(s).`);
    for (const item of missing) console.warn(`missing: ${item.ref.value} -> ${item.localPath}`);
  }

  if (!options.apply) {
    for (const item of planned) console.log(`dry-run: ${item.ref.value} -> ${item.localPath}`);
    console.log('Dry run only. Re-run with --apply to upload and update DB.');
    return { planned: planned.length, missing: missing.length, migrated: 0 };
  }

  let migrated = 0;
  for (const item of planned) {
    const fileName = fileNameForRef(item.ref, item.localPath);
    const bytes = await fs.readFile(item.localPath);
    const file = new File([bytes], fileName, { type: guessStorageContentType(fileName) });
    const uploaded = await uploadCharacterAssetToStorage({
      file,
      fileName,
      kind: item.ref.kind === 'previewVideo' ? 'video' : 'character-image',
    });
    await updateRef(item.ref, uploaded.path);
    migrated += 1;
    console.log(`migrated: ${item.ref.value} -> ${uploaded.path}`);
  }

  return { planned: planned.length, missing: missing.length, migrated };
}

const isDirectRun = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isDirectRun) {
  const options = parseArgs(process.argv.slice(2));
  migrateCharacterAssetsToStorage(options)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect().catch(() => undefined);
    });
}
