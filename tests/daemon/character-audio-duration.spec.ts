import { beforeEach, describe, expect, it, vi } from 'vitest';

const execFileMock = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', () => ({
  execFile: execFileMock,
}));

vi.mock('../../scripts/daemon/helpers/logger', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function mockDurations(durations: number[]) {
  const queue = [...durations];
  execFileMock.mockImplementation((command: string, _args: string[], callback: (error: Error | null, result?: { stdout: string; stderr: string }) => void) => {
    if (command === 'ffprobe') {
      const next = queue.shift();
      callback(null, { stdout: `${next ?? 0}\n`, stderr: '' });
      return;
    }
    if (command === 'ffmpeg') {
      callback(null, { stdout: '', stderr: '' });
      return;
    }
    callback(new Error(`Unexpected command: ${command}`));
  });
}

describe('clampCharacterAudioDuration', () => {
  beforeEach(() => {
    execFileMock.mockReset();
  });

  it('returns the original path without ffmpeg when duration is under the character limit', async () => {
    mockDurations([20]);
    const { clampCharacterAudioDuration } = await import('../../scripts/daemon/helpers/character-audio-duration');

    const result = await clampCharacterAudioDuration({
      projectId: 'project-1',
      languageCode: 'en',
      inputPath: '/tmp/take-1.wav',
    });

    expect(result).toEqual({
      path: '/tmp/take-1.wav',
      originalDurationSeconds: 20,
      finalDurationSeconds: 20,
      processed: false,
      attempts: 0,
    });
    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock.mock.calls[0][0]).toBe('ffprobe');
  });

  it('speeds up and verifies character audio when duration is even slightly over 20 seconds', async () => {
    mockDurations([20.001, 19.97]);
    const { clampCharacterAudioDuration } = await import('../../scripts/daemon/helpers/character-audio-duration');

    const result = await clampCharacterAudioDuration({
      projectId: 'project-1',
      languageCode: 'en',
      inputPath: '/tmp/take-1.wav',
    });

    expect(result).toEqual({
      path: '/tmp/take-1.character-20s-attempt-1.wav',
      originalDurationSeconds: 20.001,
      finalDurationSeconds: 19.97,
      processed: true,
      attempts: 1,
    });
    const ffmpegCall = execFileMock.mock.calls.find((call) => call[0] === 'ffmpeg');
    expect(ffmpegCall?.[1]).toEqual(expect.arrayContaining([
      '-filter:a',
      expect.stringMatching(/^atempo=1\.002/),
      '/tmp/take-1.character-20s-attempt-1.wav',
    ]));
  });

  it('retries with the measured processed duration when the first clamp is still too long', async () => {
    mockDurations([20.5, 20.0005, 19.96]);
    const { clampCharacterAudioDuration } = await import('../../scripts/daemon/helpers/character-audio-duration');

    const result = await clampCharacterAudioDuration({
      projectId: 'project-1',
      languageCode: 'en',
      inputPath: '/tmp/take-1.wav',
    });

    expect(result.path).toBe('/tmp/take-1.character-20s-attempt-2.wav');
    expect(result.attempts).toBe(2);
    expect(result.finalDurationSeconds).toBe(19.96);
    expect(execFileMock.mock.calls.filter((call) => call[0] === 'ffmpeg')).toHaveLength(2);
  });

  it('fails rather than uploading audio that remains over the character limit after three attempts', async () => {
    mockDurations([21, 20.5, 20.2, 20.001]);
    const { clampCharacterAudioDuration } = await import('../../scripts/daemon/helpers/character-audio-duration');

    await expect(clampCharacterAudioDuration({
      projectId: 'project-1',
      languageCode: 'en',
      inputPath: '/tmp/take-1.wav',
    })).rejects.toThrow('Character audio is still longer than 20s after 3 clamp attempts');
    expect(execFileMock.mock.calls.filter((call) => call[0] === 'ffmpeg')).toHaveLength(3);
  });
});
