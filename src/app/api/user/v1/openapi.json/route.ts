import { userApiOpenApiSpec } from '@/server/user-api/openapi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(userApiOpenApiSpec, {
    headers: { 'cache-control': 'no-store' },
  });
}
