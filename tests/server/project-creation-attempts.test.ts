import { describe, expect, it, vi } from 'vitest';
import { LIMITS } from '@/server/limits';

vi.mock('@/server/db', () => ({ prisma: {} }));
vi.mock('@/server/config', () => ({ config: {} }));

import { normalizeProjectCreationAttemptPayload } from '@/server/analytics/project-attempts';
import { TELEGRAM_SEND_MESSAGE_TEXT_LIMIT, clipTelegramText } from '@/server/telegram';

describe('project creation attempt normalization', () => {
  it('keeps only bounded and whitelisted attribution data', () => {
    const payload = normalizeProjectCreationAttemptPayload({
      clientAttemptId: 'abc\0def',
      result: 'paywall_shown',
      promptText: ` ${'x'.repeat(LIMITS.promptMax + 50)} `,
      promptMode: 'idea',
      projectExperience: 'story',
      referrer: 'https://example.com/path/to/page?secret=token',
      landingPath: '/?utm_source=hidden',
      query: {
        utm_source: 'newsletter',
        yc_t: 'script-wizard',
        ignored: '<script>alert(1)</script>',
      },
      languageCodes: ['en', 'ru', 'x'.repeat(100)],
      languageVoices: {
        en: 'voice-1',
        bad: '',
      },
      rawContext: {
        nested: {
          value: 'ok',
        },
      },
    });

    expect(payload.clientAttemptId).toBe('abcdef');
    expect(payload.promptText).toHaveLength(LIMITS.promptMax);
    expect(payload.utmSource).toBe('newsletter');
    expect(payload.sourceToolSlug).toBe('script-wizard');
    expect(payload.query).toEqual({ utm_source: 'newsletter', yc_t: 'script-wizard' });
    expect(payload.referrerOrigin).toBe('https://example.com');
    expect(payload.referrerPath).toBe('/path/to/page');
    expect(payload.landingPath).toBe('/');
    expect(payload.languageCodes).toEqual(['en', 'ru', 'x'.repeat(16)]);
    expect(payload.languageVoices).toEqual({ en: 'voice-1' });
  });

  it('falls back to paywall_shown for invalid result values', () => {
    const payload = normalizeProjectCreationAttemptPayload({ result: 'DROP TABLE Project' });
    expect(payload.result).toBe('paywall_shown');
  });
});

describe('Telegram message clipping', () => {
  it('clips below the sendMessage text limit', () => {
    const clipped = clipTelegramText('a'.repeat(10_000));

    expect(Array.from(clipped).length).toBeLessThan(TELEGRAM_SEND_MESSAGE_TEXT_LIMIT);
    expect(clipped).toContain('[truncated]');
  });
});
