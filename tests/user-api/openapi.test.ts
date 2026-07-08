import { describe, expect, it } from 'vitest';
import { userApiOpenApiSpec } from '@/server/user-api/openapi';
import * as openapiRoute from '@/app/api/user/v1/openapi.json/route';
import * as docsRoute from '@/app/api/user/v1/docs/route';

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

  it('serves the OpenAPI JSON route without authentication', async () => {
    const res = openapiRoute.GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(body.info.title).toBe('YumCut User API');
    expect(body.paths['/projects'].post.parameters).toContainEqual(expect.objectContaining({
      name: 'Idempotency-Key',
      required: true,
    }));
  });

  it('serves Scalar API documentation pointed at the OpenAPI route', async () => {
    const res = docsRoute.GET();
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('YumCut User API');
    expect(html).toContain('/api/user/v1/openapi.json');
  });
});
