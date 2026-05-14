import { describe, expect, it } from 'vitest';
import {
  ADMIN_CHARACTER_IMPORT_VALIDATION_LIMITS,
  validateAdminCharacterImportRow,
} from '@/shared/validators/admin-character-import';

function makeFile(name: string, size: number, type = 'image/webp') {
  return { name, size, type };
}

describe('validateAdminCharacterImportRow', () => {
  it('passes for a valid row', () => {
    const res = validateAdminCharacterImportRow({
      slug: 'valid-character',
      name: 'Valid Character',
      title: 'Valid Character',
      bio: 'Short bio',
      preparedFile: makeFile('prepared.webp', 50 * 1024),
      emptyFile: makeFile('empty.webp', 50 * 1024),
    });
    expect(res.issues).toHaveLength(0);
  });

  it('fails when slug/title/name are missing', () => {
    const res = validateAdminCharacterImportRow({
      slug: '',
      name: '',
      title: '',
      bio: '',
      preparedFile: makeFile('prepared.webp', 50 * 1024),
      emptyFile: makeFile('empty.webp', 50 * 1024),
    });
    expect(res.fieldErrors.slug).toMatch(/required/i);
    expect(res.fieldErrors.name).toMatch(/required/i);
    expect(res.fieldErrors.title).toMatch(/required/i);
  });

  it('fails when fields exceed configured max lengths', () => {
    const limits = ADMIN_CHARACTER_IMPORT_VALIDATION_LIMITS;
    const res = validateAdminCharacterImportRow({
      slug: `a${'b'.repeat(limits.slugMax)}`,
      name: 'n'.repeat(limits.nameMax + 1),
      title: 't'.repeat(limits.titleMax + 1),
      bio: 'b'.repeat(limits.bioMax + 1),
      preparedFile: makeFile('prepared.webp', 50 * 1024),
      emptyFile: makeFile('empty.webp', 50 * 1024),
    });
    expect(res.fieldErrors.slug).toMatch(/at most/i);
    expect(res.fieldErrors.name).toMatch(/at most/i);
    expect(res.fieldErrors.title).toMatch(/at most/i);
    expect(res.fieldErrors.bio).toMatch(/short description/i);
    expect(res.fieldErrors.bio).toContain(`current: ${limits.bioMax + 1}`);
  });

  it('fails when files are outside size limits', () => {
    const limits = ADMIN_CHARACTER_IMPORT_VALIDATION_LIMITS;
    const res = validateAdminCharacterImportRow({
      slug: 'valid-character',
      name: 'Valid Character',
      title: 'Valid Character',
      bio: '',
      preparedFile: makeFile('prepared.webp', limits.fileMinBytes - 1),
      emptyFile: makeFile('empty.webp', limits.fileMaxBytes + 1),
    });
    expect(res.fieldErrors.preparedFile).toMatch(/too small/i);
    expect(res.fieldErrors.emptyFile).toMatch(/too large/i);
  });

  it('fails when file extension or mime type is invalid', () => {
    const res = validateAdminCharacterImportRow({
      slug: 'valid-character',
      name: 'Valid Character',
      title: 'Valid Character',
      bio: '',
      preparedFile: makeFile('prepared.png', 50 * 1024, 'image/png'),
      emptyFile: makeFile('empty.webp', 50 * 1024, 'application/octet-stream'),
    });
    expect(res.issues.some((entry) => entry.field === 'preparedFile' && /must use/i.test(entry.message))).toBe(true);
    expect(res.issues.some((entry) => entry.field === 'preparedFile' && /type must be/i.test(entry.message))).toBe(true);
    expect(res.issues.some((entry) => entry.field === 'emptyFile' && /type must be/i.test(entry.message))).toBe(true);
  });
});
