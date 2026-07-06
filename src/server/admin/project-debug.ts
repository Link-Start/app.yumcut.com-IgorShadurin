import { promises as fs } from 'node:fs';
import path from 'node:path';
import { prisma } from '@/server/db';
import {
  buildProjectErrorStatusInfo,
  getLatestErrorLog,
  getProjectErrorLogFileForAdmin,
  resolveProjectsWorkspace,
} from '@/server/projects/errors';
import {
  PROJECT_RELATED_TOKEN_TYPES,
  extractProjectIdFromTokenMetadata,
} from '@/server/admin/token-usage';
import { ProjectStatus } from '@/shared/constants/status';

export type AdminProjectDebugBundle = {
  project: unknown;
  user: unknown;
  statusHistory: unknown[];
  jobs: unknown[];
  scripts: unknown[];
  audios: unknown[];
  videos: unknown[];
  images: unknown[];
  artifacts: unknown[];
  templateImages: unknown[];
  languageProgress: unknown[];
  creationAttempts: unknown[];
  publishTasks: unknown[];
  tokenTransactions: unknown[];
  error: unknown;
  files: {
    projectsWorkspace: string | null;
    projectRoot: string | null;
    items: AdminProjectDebugFile[];
  };
};

export type AdminProjectDebugFile = {
  path: string;
  relativePath: string | null;
  source: string;
  exists: boolean;
  sizeBytes: number | null;
  preview: string | null;
  truncated: boolean;
  skippedReason: string | null;
};

const DEFAULT_DEBUG_RELATION_LIMIT = 100;
const MAX_DEBUG_RELATION_LIMIT = 500;
const DEFAULT_DEBUG_FILE_MAX_BYTES = 64 * 1024;
const MAX_DEBUG_FILE_MAX_BYTES = 512 * 1024;
const TEXT_FILE_EXTENSIONS = new Set(['.log', '.txt', '.json', '.md', '.csv']);
const EXTRA_PATH_KEYS = new Set([
  'logPath',
  'logDir',
  'templateLaunchLog',
  'metadataJsonPath',
  'workspace',
  'workspaceRoot',
  'videoWorkspace',
  'videoWorkspaceRoot',
  'imagesWorkspace',
  'imagesWorkspaceRoot',
  'imageGenerationWorkspace',
  'audioLocalPath',
]);

export function normalizeDebugLimit(value: string | null | undefined) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_DEBUG_RELATION_LIMIT;
  return Math.min(Math.max(Math.floor(parsed), 1), MAX_DEBUG_RELATION_LIMIT);
}

export function normalizeDebugFileMaxBytes(value: string | null | undefined) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_DEBUG_FILE_MAX_BYTES;
  return Math.min(Math.max(Math.floor(parsed), 1024), MAX_DEBUG_FILE_MAX_BYTES);
}

export async function getAdminProjectDebugBundle(projectId: string, options: {
  relationLimit?: number;
  fileMaxBytes?: number;
} = {}): Promise<AdminProjectDebugBundle | null> {
  const relationLimit = options.relationLimit ?? DEFAULT_DEBUG_RELATION_LIMIT;
  const fileMaxBytes = options.fileMaxBytes ?? DEFAULT_DEBUG_FILE_MAX_BYTES;
  const project = await prisma.project.findFirst({
    where: { id: projectId, deleted: false },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          isAdmin: true,
          createdAt: true,
          tokenBalance: true,
          preferredLanguage: true,
        },
      },
      statusLog: { orderBy: { createdAt: 'desc' }, take: relationLimit },
      jobs: { orderBy: { createdAt: 'desc' }, take: relationLimit },
      scripts: true,
      audios: true,
      videos: true,
      images: { orderBy: { createdAt: 'desc' }, take: relationLimit },
      artifacts: { orderBy: { createdAt: 'desc' }, take: relationLimit },
      templateImages: {
        orderBy: { imageName: 'asc' },
        take: relationLimit,
        include: { imageAsset: true },
      },
      languageProgress: true,
      creationAttempts: { orderBy: { createdAt: 'desc' }, take: relationLimit },
      publishTasks: { orderBy: { createdAt: 'desc' }, take: relationLimit },
      selection: true,
    },
  });
  if (!project) return null;

  const latestErrorLog = project.status === ProjectStatus.Error
    ? await getLatestErrorLog(prisma, project.id)
    : null;
  const latestStatusLog = project.statusLog[0] ?? null;
  const errorInfo = project.status === ProjectStatus.Error
    ? buildProjectErrorStatusInfo(latestErrorLog, latestStatusLog, { includeExtra: true })
    : null;
  const errorLogFile = project.status === ProjectStatus.Error
    ? await getProjectErrorLogFileForAdmin(project.id, errorInfo?.errorExtra ?? null, { maxBytes: fileMaxBytes })
    : null;

  const projectRelatedTokenRows = await prisma.tokenTransaction.findMany({
    where: {
      userId: project.userId,
      type: { in: [...PROJECT_RELATED_TOKEN_TYPES] },
    },
    orderBy: { createdAt: 'desc' },
    take: relationLimit * 5,
  });
  const tokenTransactions = projectRelatedTokenRows
    .filter((row) => extractProjectIdFromTokenMetadata(row.metadata) === project.id)
    .slice(0, relationLimit);

  const files = await collectProjectDebugFiles(project.id, {
    fileMaxBytes,
    errorExtra: errorInfo?.errorExtra ?? null,
    rows: {
      audios: project.audios,
      artifacts: project.artifacts,
      videos: project.videos,
    },
  });

  return {
    project: {
      id: project.id,
      userId: project.userId,
      title: project.title,
      prompt: project.prompt,
      rawScript: project.rawScript,
      finalScriptText: project.finalScriptText,
      finalVoiceoverId: project.finalVoiceoverId,
      finalVoiceoverPath: project.finalVoiceoverPath,
      finalVoiceoverUrl: project.finalVoiceoverUrl,
      finalVideoPath: project.finalVideoPath,
      finalVideoUrl: project.finalVideoUrl,
      status: project.status,
      deleted: project.deleted,
      deletedAt: project.deletedAt,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      languages: project.languages,
      currentDaemonId: project.currentDaemonId,
      currentDaemonLockedAt: project.currentDaemonLockedAt,
      voiceId: project.voiceId,
      voiceProvider: project.voiceProvider,
      languageVoiceAssignments: project.languageVoiceAssignments,
      languageVoiceProviders: project.languageVoiceProviders,
      contentTone: project.contentTone,
      groupId: project.groupId,
      templateId: project.templateId,
      selection: project.selection,
    },
    user: project.user,
    statusHistory: project.statusLog,
    jobs: project.jobs,
    scripts: project.scripts,
    audios: project.audios,
    videos: project.videos,
    images: project.images,
    artifacts: project.artifacts,
    templateImages: project.templateImages,
    languageProgress: project.languageProgress,
    creationAttempts: project.creationAttempts,
    publishTasks: project.publishTasks,
    tokenTransactions,
    error: errorInfo
      ? {
          ...errorInfo,
          ...(errorLogFile ? { errorLogFile } : {}),
        }
      : null,
    files,
  };
}

async function collectProjectDebugFiles(projectId: string, input: {
  fileMaxBytes: number;
  errorExtra: Record<string, unknown> | null;
  rows: {
    audios: Array<{ localPath?: string | null }>;
    artifacts: Array<{ localPath?: string | null }>;
    videos: Array<{ path?: string | null; publicUrl?: string | null }>;
  };
}): Promise<AdminProjectDebugBundle['files']> {
  const projectsWorkspace = resolveProjectsWorkspace();
  if (!projectsWorkspace) {
    return { projectsWorkspace: null, projectRoot: null, items: [] };
  }

  const projectRoot = path.resolve(projectsWorkspace, projectId);
  const collector = new DebugFileCollector(projectRoot, input.fileMaxBytes);

  for (const candidate of collectExtraPathCandidates(input.errorExtra)) {
    await collector.addCandidate(candidate, 'status-extra');
  }
  for (const audio of input.rows.audios) {
    await collector.addCandidate(audio.localPath ?? null, 'audio-local-path');
  }
  for (const artifact of input.rows.artifacts) {
    await collector.addCandidate(artifact.localPath ?? null, 'artifact-local-path');
  }

  await collector.addDirectory(path.join(projectRoot, 'logs'), 'project-logs');
  await collector.addDirectory(path.join(projectRoot, 'workspace'), 'project-workspace-text');

  return {
    projectsWorkspace,
    projectRoot,
    items: collector.items,
  };
}

class DebugFileCollector {
  readonly items: AdminProjectDebugFile[] = [];
  private readonly seen = new Set<string>();

  constructor(
    private readonly projectRoot: string,
    private readonly fileMaxBytes: number,
  ) {}

  async addCandidate(candidate: string | null | undefined, source: string) {
    const safePath = this.resolveSafePath(candidate);
    if (!safePath) return;
    await this.addPath(safePath, source);
  }

  async addDirectory(dirPath: string, source: string) {
    const safePath = this.resolveSafePath(dirPath);
    if (!safePath) return;
    const stats = await statIfExists(safePath);
    if (!stats?.isDirectory()) return;
    await this.walkDirectory(safePath, source, 0);
  }

  private async walkDirectory(dirPath: string, source: string, depth: number) {
    if (this.items.length >= 100 || depth > 6) return;
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (this.items.length >= 100) return;
      if (entry.name === 'node_modules' || entry.name.startsWith('.git')) continue;
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        await this.walkDirectory(fullPath, source, depth + 1);
      } else if (entry.isFile() && isTextDebugFile(fullPath)) {
        await this.addPath(fullPath, source);
      }
    }
  }

  private resolveSafePath(candidate: string | null | undefined) {
    const normalized = typeof candidate === 'string' ? candidate.trim() : '';
    if (!normalized) return null;
    const resolved = path.resolve(path.isAbsolute(normalized) ? normalized : path.join(this.projectRoot, normalized));
    if (resolved !== this.projectRoot && !resolved.startsWith(`${this.projectRoot}${path.sep}`)) {
      return null;
    }
    return resolved;
  }

  private async addPath(filePath: string, source: string) {
    if (this.seen.has(filePath)) return;
    this.seen.add(filePath);
    const stats = await statIfExists(filePath);
    const relativePath = path.relative(this.projectRoot, filePath) || null;
    if (!stats) {
      this.items.push({
        path: filePath,
        relativePath,
        source,
        exists: false,
        sizeBytes: null,
        preview: null,
        truncated: false,
        skippedReason: 'not_found',
      });
      return;
    }
    if (!stats.isFile()) {
      return;
    }
    if (!isTextDebugFile(filePath)) {
      this.items.push({
        path: filePath,
        relativePath,
        source,
        exists: true,
        sizeBytes: stats.size,
        preview: null,
        truncated: false,
        skippedReason: 'non_text_file',
      });
      return;
    }
    const preview = await readBoundedText(filePath, stats.size, this.fileMaxBytes);
    this.items.push({
      path: filePath,
      relativePath,
      source,
      exists: true,
      sizeBytes: stats.size,
      preview,
      truncated: stats.size > this.fileMaxBytes,
      skippedReason: null,
    });
  }
}

function collectExtraPathCandidates(value: unknown): string[] {
  const paths: string[] = [];
  const visit = (entry: unknown, key?: string) => {
    if (paths.length >= 50) return;
    if (typeof entry === 'string' && key && EXTRA_PATH_KEYS.has(key)) {
      paths.push(entry);
      return;
    }
    if (!entry || typeof entry !== 'object') return;
    if (Array.isArray(entry)) {
      for (const item of entry.slice(0, 20)) visit(item);
      return;
    }
    for (const [childKey, childValue] of Object.entries(entry as Record<string, unknown>)) {
      visit(childValue, childKey);
    }
  };
  visit(value);
  return paths;
}

function isTextDebugFile(filePath: string) {
  return TEXT_FILE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

async function statIfExists(filePath: string) {
  try {
    return await fs.stat(filePath);
  } catch (error: any) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return null;
    throw error;
  }
}

async function readBoundedText(filePath: string, sizeBytes: number, maxBytes: number) {
  if (sizeBytes <= maxBytes) {
    return fs.readFile(filePath, 'utf8');
  }
  const file = await fs.open(filePath, 'r');
  try {
    const headBytes = Math.min(32 * 1024, Math.floor(maxBytes / 2));
    const tailBytes = Math.max(0, maxBytes - headBytes);
    const head = Buffer.alloc(headBytes);
    const tail = Buffer.alloc(tailBytes);
    const headRead = await file.read(head, 0, headBytes, 0);
    const tailRead = await file.read(tail, 0, tailBytes, Math.max(0, sizeBytes - tailBytes));
    return [
      head.subarray(0, headRead.bytesRead).toString('utf8'),
      `\n\n--- file truncated: showing first ${headRead.bytesRead} bytes and last ${tailRead.bytesRead} bytes of ${sizeBytes} bytes ---\n\n`,
      tail.subarray(0, tailRead.bytesRead).toString('utf8'),
    ].join('');
  } finally {
    await file.close();
  }
}
