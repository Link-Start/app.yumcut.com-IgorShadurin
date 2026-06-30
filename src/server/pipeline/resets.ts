import type { PrismaClient } from '@prisma/client';
import { promises as fs } from 'node:fs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ProjectStatus } from '@/shared/constants/status';
import { downstreamStatuses } from '@/shared/pipeline/status-order';
import { jobTypeForStatus } from '@/shared/pipeline/job-types';
import type { ProjectExperience } from '@/shared/constants/project-experience';
import { DEFAULT_LANGUAGE, normalizeLanguageList } from '@/shared/constants/languages';

type ProgressField = 'transcriptionDone' | 'captionsDone' | 'videoPartsDone' | 'finalVideoDone';

const FULL_RESET_FIELDS: ProgressField[] = ['transcriptionDone', 'captionsDone', 'videoPartsDone', 'finalVideoDone'];

const PROGRESS_RESET_FIELDS: Partial<Record<ProjectStatus, ProgressField[]>> = {
  [ProjectStatus.New]: FULL_RESET_FIELDS,
  [ProjectStatus.ProcessScript]: FULL_RESET_FIELDS,
  [ProjectStatus.ProcessScriptValidate]: FULL_RESET_FIELDS,
  [ProjectStatus.ProcessAudio]: FULL_RESET_FIELDS,
  [ProjectStatus.ProcessAudioValidate]: FULL_RESET_FIELDS,
  [ProjectStatus.ProcessTranscription]: FULL_RESET_FIELDS,
  [ProjectStatus.ProcessMetadata]: ['captionsDone', 'videoPartsDone', 'finalVideoDone'],
  [ProjectStatus.ProcessCaptionsVideo]: ['captionsDone', 'videoPartsDone', 'finalVideoDone'],
  [ProjectStatus.ProcessImagesGeneration]: ['videoPartsDone', 'finalVideoDone'],
  [ProjectStatus.ProcessVideoPartsGeneration]: ['videoPartsDone', 'finalVideoDone'],
  [ProjectStatus.ProcessVideoMain]: ['finalVideoDone'],
};

export type ProgressResetPlan = {
  fields: ProgressField[];
  updateData: Partial<Record<ProgressField, boolean>>;
  clearFinalVideo: boolean;
};

export type WorkspaceInvalidationResult = {
  considered: number;
  deleted: number;
  skipped: boolean;
  paths: string[];
};

export function buildProgressResetPlan(status: ProjectStatus): ProgressResetPlan {
  const configured = PROGRESS_RESET_FIELDS[status] ?? [];
  const fields = Array.from(new Set(configured));
  const updateData: Partial<Record<ProgressField, boolean>> = {};
  for (const field of fields) {
    updateData[field] = false;
  }
  return {
    fields,
    updateData,
    clearFinalVideo: fields.includes('finalVideoDone'),
  };
}

export function shouldInvalidateMetadataForReset(status: ProjectStatus): boolean {
  return [
    ProjectStatus.New,
    ProjectStatus.ProcessScript,
    ProjectStatus.ProcessScriptValidate,
    ProjectStatus.ProcessAudio,
    ProjectStatus.ProcessAudioValidate,
    ProjectStatus.ProcessTranscription,
    ProjectStatus.ProcessMetadata,
  ].includes(status);
}

function parseEnvFileValue(filePath: string, key: string): string | null {
  try {
    const content = readFileSync(filePath, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx === -1) continue;
      if (line.slice(0, idx).trim() !== key) continue;
      let value = line.slice(idx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      return value || null;
    }
  } catch {
    return null;
  }
  return null;
}

function resolveProjectsWorkspace(): string | null {
  const fromEnv = process.env.DAEMON_PROJECTS_WORKSPACE?.trim();
  const raw =
    fromEnv
    || (process.env.DAEMON_ENV_FILE ? parseEnvFileValue(path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.DAEMON_ENV_FILE), 'DAEMON_PROJECTS_WORKSPACE') : null)
    || parseEnvFileValue(path.resolve(/* turbopackIgnore: true */ process.cwd(), '.daemon.env'), 'DAEMON_PROJECTS_WORKSPACE');
  if (!raw) return null;
  return path.isAbsolute(raw) ? raw : path.resolve(/* turbopackIgnore: true */ process.cwd(), raw);
}

function normalizeLanguageCodes(values: unknown): string[] {
  return normalizeLanguageList(values ?? DEFAULT_LANGUAGE, DEFAULT_LANGUAGE);
}

export async function invalidateResetMetadataArtifacts(
  prisma: PrismaClient,
  projectId: string,
  options: { languages?: string[] | null; projectsWorkspace?: string | null } = {},
): Promise<WorkspaceInvalidationResult> {
  const explicitProjectsWorkspace = options.projectsWorkspace?.trim();
  const projectsWorkspace = explicitProjectsWorkspace
    ? (path.isAbsolute(explicitProjectsWorkspace) ? explicitProjectsWorkspace : path.resolve(/* turbopackIgnore: true */ process.cwd(), explicitProjectsWorkspace))
    : resolveProjectsWorkspace();

  if (!projectsWorkspace) {
    return { considered: 0, deleted: 0, skipped: true, paths: [] };
  }

  const explicitLanguages = options.languages && options.languages.length > 0
    ? normalizeLanguageCodes(options.languages)
    : [];

  let languages = explicitLanguages;
  if (languages.length === 0) {
    const progressRows = await prisma.projectLanguageProgress.findMany({
      where: { projectId },
      select: { languageCode: true } as any,
    } as any);
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { languages: true },
    });
    const fromProgress = progressRows.map((row: { languageCode?: string | null }) => row.languageCode).filter(Boolean);
    languages = normalizeLanguageCodes([...fromProgress, ...normalizeLanguageCodes((project as any)?.languages ?? DEFAULT_LANGUAGE)]);
  }

  const paths = languages.map((languageCode) =>
    path.join(projectsWorkspace, projectId, 'workspace', languageCode, 'metadata', 'transcript-blocks.json'),
  );

  let deleted = 0;
  await Promise.all(paths.map(async (target) => {
    try {
      await fs.stat(target);
      await fs.rm(target, { force: true });
      deleted += 1;
    } catch {
      // Workspace cleanup should not block a DB reset; the next metadata phase can still fail explicitly if input is invalid.
    }
  }));

  return { considered: paths.length, deleted, skipped: false, paths };
}

export async function resetStageJobs(prisma: PrismaClient, projectId: string, jobType: string) {
  const now = new Date();
  const staged = await prisma.job.findMany({
    where: { projectId, type: jobType },
    orderBy: { createdAt: 'desc' },
  });

  if (staged.length > 0) {
    await prisma.job.updateMany({
      where: { projectId, type: jobType, status: { in: ['queued', 'running'] } },
      data: { status: 'failed', updatedAt: now },
    });
  }

  const user = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { userId: true } });
  await prisma.job.create({
    data: {
      projectId,
      userId: user.userId,
      type: jobType,
      status: 'queued',
      payload: (staged[0]?.payload ?? {}) as any,
    },
  });

  return { message: ` Created fresh ${jobType} job${staged.length > 0 ? ' (previous queued/running entries marked failed).' : '.'}` };
}

export async function resetDownstreamJobs(
  prisma: PrismaClient,
  projectId: string,
  status: ProjectStatus,
  projectExperience?: ProjectExperience | null,
) {
  const targets = downstreamStatuses(status, projectExperience);
  if (targets.length === 0) return { total: 0, types: [] as string[], considered: 0 };

  const types = targets
    .map((s) => jobTypeForStatus(s, projectExperience))
    .filter((type): type is string => !!type);
  if (types.length === 0) return { total: 0, types: [], considered: targets.length };

  const now = new Date();
  let total = 0;
  const touchedTypes: string[] = [];
  for (const type of types) {
    const res = await prisma.job.updateMany({
      where: { projectId, type, status: { in: ['queued', 'running'] } },
      data: { status: 'failed', updatedAt: now },
    });
    if (res.count > 0) {
      total += res.count;
      touchedTypes.push(type);
    }
  }
  return { total, types: touchedTypes, considered: targets.length };
}
