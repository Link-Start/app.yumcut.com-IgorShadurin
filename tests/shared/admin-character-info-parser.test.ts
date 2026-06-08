import { describe, expect, it } from 'vitest';
import { parseAdminCharacterInfoPayload } from '@/shared/validators/admin-character-info';

describe('parseAdminCharacterInfoPayload', () => {
  it('reads en locale bio/title/name', () => {
    const res = parseAdminCharacterInfoPayload({
      slug: 'anpali-babel',
      locales: {
        en: {
          name: 'Anpali Babel',
          title: 'Anpali Babel',
          bio: 'Short bio',
          longBio: 'Long',
        },
      },
    });
    expect(res?.slug).toBe('anpali-babel');
    expect(res?.name).toBe('Anpali Babel');
    expect(res?.title).toBe('Anpali Babel');
    expect(res?.bio).toBe('Short bio');
  });

  it('falls back to first locale when en is missing', () => {
    const res = parseAdminCharacterInfoPayload({
      slug: 'x',
      locales: {
        ru: {
          name: 'Имя',
          title: 'Заголовок',
          bio: 'Коротко',
        },
      },
    });
    expect(res?.name).toBe('Имя');
    expect(res?.title).toBe('Заголовок');
    expect(res?.bio).toBe('Коротко');
  });

  it('falls back to description fields when bio is missing', () => {
    const res = parseAdminCharacterInfoPayload({
      slug: 'desc-slug',
      locales: {
        en: {
          title: 'Title',
          description: 'Description text',
        },
      },
    });
    expect(res?.bio).toBe('Description text');
  });
});
