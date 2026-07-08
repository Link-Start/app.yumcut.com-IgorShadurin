import { describe, expect, it } from 'vitest';
import { userApiOpenApiSpec } from '@/server/user-api/openapi';

describe('user API OpenAPI spec', () => {
  it('documents bearer authentication and the user API base path', () => {
    expect(userApiOpenApiSpec.servers[0]?.url).toBe('/api/user/v1');
    expect(userApiOpenApiSpec.components.securitySchemes.BearerAuth).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
  });

  it('documents idempotency on project-creating and costly write operations', () => {
    const createProject = userApiOpenApiSpec.paths['/projects'].post;
    const regenerateImage = userApiOpenApiSpec.paths['/projects/{projectId}/images/regenerate'].post;

    expect(createProject.parameters).toContainEqual(expect.objectContaining({
      name: 'Idempotency-Key',
      in: 'header',
      required: true,
    }));
    expect(regenerateImage.parameters).toContainEqual(expect.objectContaining({
      name: 'Idempotency-Key',
      in: 'header',
      required: true,
    }));
    expect(createProject.responses).toHaveProperty('409');
  });

  it('does not expose billing, account deletion, or admin paths', () => {
    const paths = Object.keys(userApiOpenApiSpec.paths);
    expect(paths.some((path) => path.includes('subscription'))).toBe(false);
    expect(paths.some((path) => path.includes('billing'))).toBe(false);
    expect(paths.some((path) => path.includes('delete-account'))).toBe(false);
    expect(paths.some((path) => path.startsWith('/admin'))).toBe(false);
  });
});
