import { NextRequest } from 'next/server';
import { withApiError } from '@/server/errors';
import { notFound, ok } from '@/server/http';
import { requireAdminApiKey } from '@/server/admin/api-auth';
import { getProjectDetailForAdmin } from '@/server/admin/projects';
import {
  noStoreInit,
  pickFields,
  resolveFieldSelection,
} from '@/server/admin/read-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { projectId: string };

const PROJECT_DETAIL_FIELDS = [
  'project',
  'user',
  'latestLogMessage',
  'languageProgress',
  'tokensUsed',
] as const;

const DEFAULT_PROJECT_DETAIL_FIELDS = [
  'project',
  'user',
  'latestLogMessage',
  'tokensUsed',
] as const satisfies readonly (typeof PROJECT_DETAIL_FIELDS[number])[];

type ProjectDetailField = typeof PROJECT_DETAIL_FIELDS[number];

export const GET = withApiError(async function GET(req: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireAdminApiKey(req, 'read');
  if (!auth.context) return auth.error;

  const selection = resolveFieldSelection(req.nextUrl.searchParams, PROJECT_DETAIL_FIELDS, DEFAULT_PROJECT_DETAIL_FIELDS);
  if (!selection.fields) return selection.error;

  const { projectId } = await params;
  const detail = await getProjectDetailForAdmin(projectId);
  if (!detail) return notFound('Project not found');

  return ok(pickFields<ProjectDetailField>(selection.fields, {
    project: detail.project,
    user: detail.user,
    latestLogMessage: detail.latestLogMessage,
    languageProgress: detail.languageProgress,
    tokensUsed: detail.tokensUsed,
  }), noStoreInit());
}, 'Failed to load admin API project');
