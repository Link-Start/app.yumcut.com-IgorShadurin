import { NextRequest } from 'next/server';
import { withApiError } from '@/server/errors';
import { notFound, ok } from '@/server/http';
import { requireAdminApiKey } from '@/server/admin/api-auth';
import {
  getAdminProjectDebugBundle,
  normalizeDebugFileMaxBytes,
  normalizeDebugLimit,
} from '@/server/admin/project-debug';
import {
  noStoreInit,
  pickFields,
  resolveFieldSelection,
} from '@/server/admin/read-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { projectId: string };

const PROJECT_DEBUG_FIELDS = [
  'project',
  'user',
  'statusHistory',
  'jobs',
  'scripts',
  'audios',
  'videos',
  'images',
  'artifacts',
  'templateImages',
  'languageProgress',
  'creationAttempts',
  'publishTasks',
  'tokenTransactions',
  'error',
  'files',
] as const;

const DEFAULT_PROJECT_DEBUG_FIELDS = PROJECT_DEBUG_FIELDS;

type ProjectDebugField = typeof PROJECT_DEBUG_FIELDS[number];

export const GET = withApiError(async function GET(req: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireAdminApiKey(req, 'read');
  if (!auth.context) return auth.error;

  const selection = resolveFieldSelection(req.nextUrl.searchParams, PROJECT_DEBUG_FIELDS, DEFAULT_PROJECT_DEBUG_FIELDS);
  if (!selection.fields) return selection.error;

  const { projectId } = await params;
  const bundle = await getAdminProjectDebugBundle(projectId, {
    relationLimit: normalizeDebugLimit(req.nextUrl.searchParams.get('relationLimit')),
    fileMaxBytes: normalizeDebugFileMaxBytes(req.nextUrl.searchParams.get('fileMaxBytes')),
  });
  if (!bundle) return notFound('Project not found');

  return ok(pickFields<ProjectDebugField>(selection.fields, bundle as Record<ProjectDebugField, unknown>), noStoreInit());
}, 'Failed to load admin project debug bundle');
