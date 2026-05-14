#!/usr/bin/env node
 
import { syncCharacterCatalogFromJson } from '@/server/character-catalog';
import { prisma } from '@/server/db';

async function main() {
  const force = process.argv.includes('--force');
  await syncCharacterCatalogFromJson({ force });
  console.log(`Character catalog sync complete${force ? ' (force)' : ''}.`);
}

main()
  .catch((error) => {
    console.error('Character catalog sync failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
