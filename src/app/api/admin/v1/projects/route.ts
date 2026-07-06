import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { withApiError } from '@/server/errors';
import { error, notFound, ok } from '@/server/http';
import { requireAdminApiKey } from '@/server/admin/api-auth';
import { runWithAuthenticatedApiUser, type AuthenticatedApiUser } from '@/server/api-user';
import { createProjectSchema } from '@/server/validators/projects';
import { normalizeMediaUrl } from '@/server/storage';
import {
  andWhere,
  cursorWhere,
  encodeReadApiCursor,
  isoDate,
  noStoreInit,
  parseBooleanQuery,
  parseReadApiListParams,
  pickFields,
  resolveFieldSelection,
} from '@/server/admin/read-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROJECT_FIELDS = [
  'id',
  'userId',
  'title',
  'prompt',
  'rawScript',
  'finalScriptText',
  'finalVoiceoverUrl',
  'finalVideoUrl',
  'status',
  'deleted',
  'deletedAt',
  'createdAt',
  'updatedAt',
  'languages',
  'groupId',
  'templateId',
  'currentDaemonId',
  'user',
  'counts',
] as const;

const DEFAULT_PROJECT_FIELDS = [
  'id',
  'userId',
  'title',
  'status',
  'createdAt',
  'updatedAt',
  'user',
] as const satisfies readonly (typeof PROJECT_FIELDS[number])[];

type ProjectField = typeof PROJECT_FIELDS[number];

function serializeProject(row: any, fields: readonly ProjectField[]) {
  return pickFields(fields, {
    id: row.id,
    userId: row.userId,
    title: row.title,
    prompt: row.prompt ?? null,
    rawScript: row.rawScript ?? null,
    finalScriptText: row.finalScriptText ?? null,
    finalVoiceoverUrl: row.finalVoiceoverUrl ?? null,
    finalVideoUrl: row.finalVideoUrl ?? null,
    status: row.status,
    deleted: row.deleted,
    deletedAt: isoDate(row.deletedAt),
    createdAt: isoDate(row.createdAt),
    updatedAt: isoDate(row.updatedAt),
    languages: row.languages ?? null,
    groupId: row.groupId ?? null,
    templateId: row.templateId ?? null,
    currentDaemonId: row.currentDaemonId ?? null,
    user: row.user
      ? {
          id: row.user.id,
          email: row.user.email,
          name: row.user.name ?? null,
        }
      : null,
    counts: {
      scripts: row._count?.scripts ?? 0,
      audios: row._count?.audios ?? 0,
      videos: row._count?.videos ?? 0,
      images: row._count?.images ?? 0,
      artifacts: row._count?.artifacts ?? 0,
      statusLog: row._count?.statusLog ?? 0,
      jobs: row._count?.jobs ?? 0,
      creationAttempts: row._count?.creationAttempts ?? 0,
    },
  });
}

const adminManualProjectCreateSchema = z.object({
  mode: z.literal('manual'),
  project: createProjectSchema,
});

const adminCloneProjectCreateSchema = z.object({
  mode: z.literal('clone'),
  sourceProjectId: z.string().uuid(),
});

const adminProjectCreateSchema = z.discriminatedUnion('mode', [
  adminManualProjectCreateSchema,
  adminCloneProjectCreateSchema,
]);

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

function sha256(value: string) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function normalizeIdempotencyKey(req: NextRequest) {
  const value = req.headers.get('idempotency-key')?.trim() ?? '';
  return value.length > 0 ? value.slice(0, 191) : null;
}

function readAdminApiContext(value: unknown): Record<string, any> | null {
  const rawContext = asRecord(value);
  const adminApi = asRecord(rawContext.adminApi);
  return Object.keys(adminApi).length > 0 ? adminApi : null;
}

function createdProjectItem(project: { id: string; title: string; status: string; createdAt: Date | string }) {
  return {
    id: project.id,
    title: project.title.length > 30 ? `${project.title.slice(0, 27)}...` : project.title,
    status: project.status,
    createdAt: isoDate(project.createdAt),
  };
}

async function ensureAdminApiProjectAttempt(input: {
  adminUserId: string;
  keyId: string;
  keyName: string;
  idempotencyKey: string;
  bodyHash: string;
  mode: 'manual' | 'clone';
  sourceProjectId?: string;
}) {
  const clientAttemptId = `adm_${input.keyId.replace(/-/g, '').slice(0, 12)}_${sha256(input.idempotencyKey).slice(0, 24)}`;
  const where = {
    userId_clientAttemptId: {
      userId: input.adminUserId,
      clientAttemptId,
    },
  };
  const existing = await prisma.projectCreationAttempt.findUnique({
    where,
    include: {
      project: {
        select: { id: true, title: true, status: true, createdAt: true },
      },
    },
  });
  if (existing) {
    const adminApi = readAdminApiContext(existing.rawContext);
    if (adminApi?.bodyHash && adminApi.bodyHash !== input.bodyHash) {
      return {
        attempt: null,
        replayProject: null,
        error: error('IDEMPOTENCY_CONFLICT', 'Idempotency-Key was already used with a different request body', 409),
      };
    }
    return {
      attempt: existing,
      replayProject: existing.project ?? null,
      error: null,
    };
  }

  const created = await prisma.projectCreationAttempt.create({
    data: {
      userId: input.adminUserId,
      clientAttemptId,
      result: 'draft_created',
      promptMode: input.mode === 'manual' ? 'idea' : null,
      projectExperience: null,
      rawContext: {
        adminApi: {
          kind: 'project-create',
          keyId: input.keyId,
          keyName: input.keyName,
          mode: input.mode,
          bodyHash: input.bodyHash,
          sourceProjectId: input.sourceProjectId ?? null,
        },
      },
    },
    include: {
      project: {
        select: { id: true, title: true, status: true, createdAt: true },
      },
    },
  });

  return {
    attempt: created,
    replayProject: null,
    error: null,
  };
}

async function loadAdminApiOwner(userId: string): Promise<AuthenticatedApiUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, isAdmin: true, deleted: true, preferredLanguage: true },
  });
  if (!user || user.deleted || !user.isAdmin) return null;
  return {
    userId: user.id,
    source: 'admin-api',
    sessionUser: {
      id: user.id,
      email: user.email,
      name: user.name,
      isAdmin: true,
      preferredLanguage: user.preferredLanguage,
    },
  };
}

async function runProjectCreateAsAdmin(auth: AuthenticatedApiUser, projectPayload: unknown) {
  const route = await import('@/app/api/projects/route');
  const req = new NextRequest('http://localhost/api/projects', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(projectPayload),
  });
  return runWithAuthenticatedApiUser(auth, () => route.POST(req));
}

function cleanOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function cleanOptionalBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined;
}

function cleanOptionalNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function cleanLanguageArray(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0) : undefined;
}

function cleanRecord(value: unknown) {
  const record = asRecord(value);
  return Object.keys(record).length > 0 ? record : undefined;
}

async function cloneCharacterSelection(source: any, payload: Record<string, any>) {
  const payloadSelection = asRecord(payload.characterSelection);
  if (payloadSelection.source === 'dynamic') return { source: 'dynamic' };
  if (payloadSelection.source === 'snapshot') return payloadSelection;

  const selection = source.selection ?? null;
  const userVariationId =
    selection?.userCharacterVariationId
    ?? (payloadSelection.userCharacterId && typeof payloadSelection.variationId === 'string' ? payloadSelection.variationId : null);

  if (userVariationId) {
    const variation = await prisma.userCharacterVariation.findFirst({
      where: { id: userVariationId, deleted: false },
      select: {
        title: true,
        imagePath: true,
        imageUrl: true,
        userCharacter: { select: { title: true } },
      },
    });
    const imagePath = variation?.imagePath ?? null;
    const imageUrl = normalizeMediaUrl(imagePath ?? variation?.imageUrl ?? null);
    if (!imagePath && !imageUrl) {
      throw new Error('Source user character image is not available for cloning');
    }
    return {
      source: 'snapshot',
      imagePath: imagePath ?? undefined,
      imageUrl: imageUrl ?? undefined,
      label: variation?.title || variation?.userCharacter?.title || 'Cloned character',
    };
  }

  if (selection?.characterId) {
    return {
      characterId: selection.characterId,
      variationId: selection.characterVariationId ?? undefined,
    };
  }

  if (payloadSelection.characterId) {
    return {
      characterId: payloadSelection.characterId,
      variationId: payloadSelection.variationId ?? undefined,
    };
  }

  return undefined;
}

function cloneImagePrankPayload(payload: Record<string, any>) {
  const imagePrank = asRecord(payload.imagePrank);
  const sourceImages = Array.isArray(imagePrank.sourceImages)
    ? imagePrank.sourceImages.map((source: any) => {
        const record = asRecord(source);
        const path = cleanOptionalString(record.imagePath) ?? cleanOptionalString(record.path) ?? cleanOptionalString(record.imageUrl);
        const url = cleanOptionalString(record.imageUrl) ?? cleanOptionalString(record.url) ?? (path ? normalizeMediaUrl(path) ?? undefined : undefined);
        return {
          role: record.role,
          path,
          url,
          label: cleanOptionalString(record.label),
          width: cleanOptionalNumber(record.width),
          height: cleanOptionalNumber(record.height),
        };
      }).filter((source: any) => source.role && source.path && source.url)
    : [];
  if (sourceImages.length === 0) return undefined;
  return {
    mode: imagePrank.mode ?? 'custom-two-image',
    catalogItemId: imagePrank.catalogItem?.id ?? imagePrank.catalogItemId ?? undefined,
    model: imagePrank.model ?? payload.model ?? undefined,
    sourceImages,
  };
}

async function buildCloneProjectPayload(sourceProjectId: string) {
  const source = await prisma.project.findFirst({
    where: { id: sourceProjectId, deleted: false },
    include: {
      selection: true,
      jobs: { orderBy: { createdAt: 'asc' }, take: 1 },
    },
  });
  if (!source) {
    return { project: null, error: notFound('Source project not found') };
  }
  const initialJob = source.jobs[0];
  if (!initialJob) {
    return { project: null, error: error('VALIDATION_ERROR', 'Source project has no initial job payload', 400) };
  }

  const payload = asRecord(initialJob.payload);
  const projectExperience = payload.projectExperience === 'image-generation'
    || initialJob.type === 'images'
    ? 'image-generation'
    : (payload.projectExperience ?? 'story');
  let characterSelection: Awaited<ReturnType<typeof cloneCharacterSelection>>;
  try {
    characterSelection = await cloneCharacterSelection(source, payload);
  } catch (err) {
    return {
      project: null,
      error: error('VALIDATION_ERROR', err instanceof Error ? err.message : 'Unable to clone character selection', 400),
    };
  }

  if (projectExperience === 'image-generation') {
    const imagePrank = payload.imageKind === 'image-prank' ? cloneImagePrankPayload(payload) : undefined;
    return {
      project: {
        mode: 'manual',
        project: {
          projectExperience: 'image-generation',
          prompt: cleanOptionalString(payload.userPrompt) ?? cleanOptionalString(source.prompt) ?? cleanOptionalString(payload.prompt) ?? source.title,
          characterSelection: imagePrank ? undefined : characterSelection,
          imagePrank,
        },
      },
      error: null,
    };
  }

  return {
    project: {
      mode: 'manual',
      project: {
        prompt: cleanOptionalString(payload.prompt) ?? cleanOptionalString(source.prompt),
        rawScript: cleanOptionalString(payload.rawScript) ?? cleanOptionalString(source.rawScript),
        durationSeconds: cleanOptionalNumber(payload.durationSeconds) ?? (projectExperience === 'character' ? 20 : 30),
        useExactTextAsScript: cleanOptionalBoolean(payload.useExactTextAsScript),
        templateId: cleanOptionalString(source.templateId) ?? cleanOptionalString(payload.templateId),
        voiceId: cleanOptionalString(payload.voiceId) ?? cleanOptionalString(source.voiceId),
        languages: cleanLanguageArray(payload.languages) ?? cleanLanguageArray(source.languages),
        languageVoices: cleanRecord(payload.languageVoices),
        videoGeneration: cleanRecord(payload.videoGeneration),
        characterVideoQuality: cleanOptionalString(payload.characterVideoQuality),
        projectExperience,
        characterSelection,
        characterSlug: characterSelection ? undefined : cleanOptionalString(payload.characterSlug),
        contentTone: cleanOptionalString(payload.contentTone) ?? cleanOptionalString(source.contentTone),
        includeDefaultMusic: cleanOptionalBoolean(payload.includeDefaultMusic),
        addOverlay: cleanOptionalBoolean(payload.addOverlay),
        includeCallToAction: cleanOptionalBoolean(payload.includeCallToAction),
        watermarkEnabled: cleanOptionalBoolean(payload.watermarkEnabled),
        captionsEnabled: cleanOptionalBoolean(payload.captionsEnabled),
      },
    },
    error: null,
  };
}

export const GET = withApiError(async function GET(req: NextRequest) {
  const auth = await requireAdminApiKey(req, 'read');
  if (!auth.context) return auth.error;

  const listParams = parseReadApiListParams(req.nextUrl.searchParams);
  if (!listParams.params) return listParams.error;

  const selection = resolveFieldSelection(req.nextUrl.searchParams, PROJECT_FIELDS, DEFAULT_PROJECT_FIELDS);
  if (!selection.fields) return selection.error;

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const status = req.nextUrl.searchParams.get('status')?.trim() ?? '';
  const userId = req.nextUrl.searchParams.get('userId')?.trim() ?? '';
  const includeDeleted = parseBooleanQuery(req.nextUrl.searchParams.get('includeDeleted'), false);
  const filters: Array<Record<string, unknown>> = [];
  if (!includeDeleted) filters.push({ deleted: false });
  if (status) filters.push({ status });
  if (userId) filters.push({ userId });
  if (q) {
    filters.push({
      OR: [
        { id: { contains: q } },
        { title: { contains: q } },
        { prompt: { contains: q } },
        { user: { email: { contains: q } } },
        { user: { name: { contains: q } } },
      ],
    });
  }

  const rows = await prisma.project.findMany({
    where: andWhere(...filters, cursorWhere(listParams.params.cursor)),
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: listParams.params.limit + 1,
    select: {
      id: true,
      userId: true,
      title: true,
      prompt: true,
      rawScript: true,
      finalScriptText: true,
      finalVoiceoverUrl: true,
      finalVideoUrl: true,
      status: true,
      deleted: true,
      deletedAt: true,
      createdAt: true,
      updatedAt: true,
      languages: true,
      groupId: true,
      templateId: true,
      currentDaemonId: true,
      user: { select: { id: true, email: true, name: true } },
      _count: {
        select: {
          scripts: true,
          audios: true,
          videos: true,
          images: true,
          artifacts: true,
          statusLog: true,
          jobs: true,
          creationAttempts: true,
        },
      },
    },
  });

  const visibleRows = rows.slice(0, listParams.params.limit);
  const last = visibleRows[visibleRows.length - 1] ?? null;
  return ok({
    items: visibleRows.map((row) => serializeProject(row, selection.fields)),
    limit: listParams.params.limit,
    nextCursor: rows.length > listParams.params.limit && last ? encodeReadApiCursor(last) : null,
  }, noStoreInit());
}, 'Failed to list admin API projects');

export const POST = withApiError(async function POST(req: NextRequest) {
  const auth = await requireAdminApiKey(req, 'write');
  if (!auth.context) return auth.error;

  const idempotencyKey = normalizeIdempotencyKey(req);
  if (!idempotencyKey) {
    return error('VALIDATION_ERROR', 'Idempotency-Key header is required', 400);
  }

  const json = await req.json().catch(() => null);
  const parsed = adminProjectCreateSchema.safeParse(json);
  if (!parsed.success) {
    return error('VALIDATION_ERROR', 'Invalid admin project create payload', 400, parsed.error.flatten());
  }

  const adminAuth = await loadAdminApiOwner(auth.context.createdByUserId);
  if (!adminAuth) {
    return error('FORBIDDEN', 'Admin API key owner is no longer active', 403);
  }

  const bodyHash = sha256(stableStringify(parsed.data));
  const attemptResult = await ensureAdminApiProjectAttempt({
    adminUserId: adminAuth.userId,
    keyId: auth.context.keyId,
    keyName: auth.context.keyName,
    idempotencyKey,
    bodyHash,
    mode: parsed.data.mode,
    sourceProjectId: parsed.data.mode === 'clone' ? parsed.data.sourceProjectId : undefined,
  });
  if (attemptResult.error) return attemptResult.error;
  if (attemptResult.replayProject) {
    return ok({
      mode: parsed.data.mode,
      ownerUserId: adminAuth.userId,
      sourceProjectId: parsed.data.mode === 'clone' ? parsed.data.sourceProjectId : null,
      idempotentReplay: true,
      item: createdProjectItem(attemptResult.replayProject),
    }, noStoreInit());
  }
  if (!attemptResult.attempt) {
    return error('IDEMPOTENCY_ERROR', 'Unable to prepare idempotent project creation', 409);
  }

  const cloneEnvelope = parsed.data.mode === 'clone'
    ? await buildCloneProjectPayload(parsed.data.sourceProjectId)
    : null;
  if (cloneEnvelope?.error) return cloneEnvelope.error;

  const manualEnvelope = parsed.data.mode === 'manual' ? parsed.data : cloneEnvelope?.project;
  if (!manualEnvelope || manualEnvelope.mode !== 'manual') {
    return error('VALIDATION_ERROR', 'Unable to build project creation payload', 400);
  }

  const createResponse = await runProjectCreateAsAdmin(adminAuth, {
    ...manualEnvelope.project,
    creationAttemptId: attemptResult.attempt.id,
  });
  const createBody = await createResponse.json().catch(() => null);
  if (!createResponse.ok) {
    return Response.json(createBody, {
      status: createResponse.status,
      headers: noStoreInit().headers,
    });
  }

  return ok({
    mode: parsed.data.mode,
    ownerUserId: adminAuth.userId,
    sourceProjectId: parsed.data.mode === 'clone' ? parsed.data.sourceProjectId : null,
    idempotentReplay: false,
    item: createBody,
  }, noStoreInit());
}, 'Failed to create admin API project');
