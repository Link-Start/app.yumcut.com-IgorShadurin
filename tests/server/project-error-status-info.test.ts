import { describe, expect, it } from 'vitest';
import { buildProjectErrorStatusInfo } from '@/server/projects/errors';

describe('buildProjectErrorStatusInfo', () => {
  it('keeps public error status limited to the display message by default', () => {
    const info = buildProjectErrorStatusInfo({
      message: 'Video parts rendering failed',
      extra: {
        phase: 'video_parts',
        error: 'Command failed with code 1',
        command: 'npm run render',
      },
      createdAt: new Date('2026-06-16T05:42:43.565Z'),
    });

    expect(info).toEqual({ message: 'Video parts rendering failed' });
  });

  it('builds admin diagnostics from status history extra', () => {
    const info = buildProjectErrorStatusInfo({
      message: 'Script phase failed',
      extra: {
        phase: 'script',
        languageCode: 'ru',
        meta: {
          reason: null,
          error: 'Command failed with code 1',
        },
      },
      createdAt: new Date('2026-06-16T05:42:43.565Z'),
    }, null, { includeExtra: true });

    expect(info.message).toBe('Script phase failed');
    expect(info.occurredAt).toBe('2026-06-16T05:42:43.565Z');
    expect(info.errorDetails).toEqual([
      { label: 'Phase', value: 'script' },
      { label: 'Language', value: 'ru' },
      { label: 'Error', value: 'Command failed with code 1' },
    ]);
    expect(info.errorExtra).toEqual({
      phase: 'script',
      languageCode: 'ru',
      meta: {
        reason: null,
        error: 'Command failed with code 1',
      },
    });
  });
});
