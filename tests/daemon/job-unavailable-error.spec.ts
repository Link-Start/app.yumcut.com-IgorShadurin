import { describe, expect, it } from 'vitest';
import { isJobUnavailableError } from '../../scripts/daemon/helpers/db';

describe('isJobUnavailableError', () => {
  it('matches prisma P2025 update-not-found errors', () => {
    const error = new Error('Failed to update job status: The requested record was not found. code=P2025');
    expect(isJobUnavailableError(error)).toBe(true);
  });

  it('matches low-level update missing record text', () => {
    const error = new Error('No record was found for an update.');
    expect(isJobUnavailableError(error)).toBe(true);
  });

  it('does not match unrelated errors', () => {
    const error = new Error('OpenRouterProvider error 401: User not found.');
    expect(isJobUnavailableError(error)).toBe(false);
  });
});

