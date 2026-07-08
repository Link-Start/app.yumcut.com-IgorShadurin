import { ApiReference } from '@scalar/nextjs-api-reference';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = ApiReference({
  url: '/api/user/v1/openapi.json',
  pageTitle: 'YumCut User API',
  theme: 'default',
  authentication: {
    preferredSecurityScheme: 'BearerAuth',
  },
} as any);
