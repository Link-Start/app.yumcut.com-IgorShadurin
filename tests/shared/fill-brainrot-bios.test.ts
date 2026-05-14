import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildOllamaFieldPrompt,
  countParagraphs,
  createLocaleSaveCoordinator,
  normalizeTextModelOutput,
} from '../../scripts/tmp/fill-brainrot-bios';

describe('fill-brainrot-bios helpers', () => {
  it('normalizes plain-text model output', () => {
    expect(normalizeTextModelOutput('```text\nHola\n```')).toBe('Hola');
    expect(normalizeTextModelOutput('"Bonjour"')).toBe('Bonjour');
    expect(normalizeTextModelOutput('  Ciao  ')).toBe('Ciao');
  });

  it('keeps paragraph count utility stable', () => {
    expect(countParagraphs('One line')).toBe(1);
    expect(countParagraphs('Para 1\n\nPara 2')).toBe(2);
    expect(countParagraphs('\n\nPara 1\n\n')).toBe(1);
  });

  it('builds ollama prompt with field and locale context', () => {
    const prompt = buildOllamaFieldPrompt({
      locale: 'es',
      localeLabel: 'Spanish',
      field: 'bio',
      text: 'Hello world',
    });
    expect(prompt).toContain('Translate from English to Spanish.');
    expect(prompt).toContain('Target locale code: es.');
    expect(prompt).toContain('Field: bio.');
    expect(prompt).toContain('Hello world');
  });

  it('does not mutate info file when coordinator runs in --no-write mode', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'bio-fill-test-'));
    const infoPath = path.join(tempDir, 'info.json');
    const original = {
      slug: 'sample',
      locales: {
        en: {
          name: 'Name',
          title: 'Title',
          bio: 'Bio',
          longBio: 'Long bio value',
        },
      },
    };

    await writeFile(infoPath, `${JSON.stringify(original, null, 2)}\n`, 'utf8');
    const coordinator = createLocaleSaveCoordinator(true);
    const result = await coordinator.enqueue({
      infoPath,
      charSlug: 'sample',
      logTag: 'test',
      locale: 'es',
      content: {
        name: 'Nombre',
        title: 'Titulo',
        bio: 'Bio ES',
        longBio: 'Long bio ES',
      },
      source: 'translation',
    });

    expect(result).toBe('simulated');
    const after = JSON.parse(await readFile(infoPath, 'utf8'));
    expect(after).toEqual(original);
    await rm(tempDir, { recursive: true, force: true });
  });
});
