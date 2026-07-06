import type { Prisma } from '@prisma/client';
import { promises as fs } from 'node:fs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ProjectStatus } from '@/shared/constants/status';

type ProjectErrorLogEntry = {
  message?: string | null;
  extra?: unknown;
  createdAt?: Date | string | null;
};

export type ProjectErrorDetail = {
  label: string;
  value: string;
};

export type ProjectErrorLogFile = {
  path: string;
  content: string;
  sizeBytes: number;
  truncated: boolean;
  source: 'status-log-path' | 'template-launch';
};

export type ProjectErrorStatusInfo = {
  message: string;
  occurredAt?: string | null;
  errorDetails?: ProjectErrorDetail[];
  errorExtra?: Record<string, unknown>;
  errorLogFile?: ProjectErrorLogFile;
};

const DEFAULT_ADMIN_ERROR_LOG_MAX_BYTES = 256 * 1024;
const TRUNCATED_HEAD_BYTES = 32 * 1024;
const TEMPLATE_LAUNCH_LOG_PATTERN = /^template-launch-.+\.log$/u;

export async function getLatestErrorLog(tx: Prisma.TransactionClient | typeof import('@/server/db').prisma, projectId: string) {
  // Fetch most recent error-specific log to avoid mixing with non-error updates.
  const errorLog = await (tx as any).projectStatusHistory.findFirst({
    where: { projectId, status: ProjectStatus.Error },
    orderBy: { createdAt: 'desc' },
    select: { message: true, extra: true, createdAt: true },
  });
  return errorLog || null;
}

export function buildProjectErrorStatusInfo(
  errorLog: ProjectErrorLogEntry | null | undefined,
  fallbackLog?: ProjectErrorLogEntry | null,
  options: { includeDetails?: boolean; includeExtra?: boolean; includeOccurredAt?: boolean } = {},
): ProjectErrorStatusInfo {
  const selectedLog = errorLog ?? fallbackLog ?? null;
  const extra = toPlainRecord(selectedLog?.extra);
  const nestedMeta = toPlainRecord(extra?.meta);
  const message =
    normalizeString(selectedLog?.message)
    ?? normalizeString(extra?.message)
    ?? normalizeString(nestedMeta?.message)
    ?? 'Unknown error';

  const includeDetails = options.includeDetails || options.includeExtra;
  const includeOccurredAt = options.includeOccurredAt || options.includeExtra;
  const details = includeDetails ? collectErrorDetails(extra, nestedMeta) : [];
  return {
    message,
    ...(includeOccurredAt ? { occurredAt: normalizeDate(selectedLog?.createdAt) } : {}),
    ...(details.length > 0 ? { errorDetails: details } : {}),
    ...(options.includeExtra && extra ? { errorExtra: extra } : {}),
  };
}

export async function getProjectErrorLogFileForAdmin(
  projectId: string,
  extra: Record<string, unknown> | null | undefined,
  options: { projectsWorkspace?: string | null; maxBytes?: number } = {},
): Promise<ProjectErrorLogFile | null> {
  const maxBytes = normalizeMaxBytes(options.maxBytes);
  const explicitWorkspaceDisabled =
    Object.prototype.hasOwnProperty.call(options, 'projectsWorkspace')
    && options.projectsWorkspace === null;
  const projectsWorkspace = explicitWorkspaceDisabled
    ? null
    : normalizeWorkspace(options.projectsWorkspace) ?? resolveProjectsWorkspace();

  for (const candidate of collectDirectLogPathCandidates(extra)) {
    if (!isProjectLogPath(candidate, projectId)) continue;
    if (!explicitWorkspaceDisabled && !isPathInsideProjectWorkspace(candidate, projectsWorkspace, projectId)) {
      continue;
    }
    const file = await readLogFileIfExists(candidate, 'status-log-path', maxBytes);
    if (file) return file;
  }

  if (!projectsWorkspace) return null;

  const latestTemplateLog = await findLatestTemplateLaunchLog(path.join(projectsWorkspace, projectId, 'workspace', 'template'));
  return latestTemplateLog ? readLogFileIfExists(latestTemplateLog, 'template-launch', maxBytes) : null;
}

function collectErrorDetails(extra: Record<string, unknown> | null, nestedMeta: Record<string, unknown> | null): ProjectErrorDetail[] {
  if (!extra && !nestedMeta) return [];
  const details: ProjectErrorDetail[] = [];
  const add = (label: string, value: unknown) => {
    const normalized = normalizeString(value);
    if (!normalized) return;
    if (details.some((detail) => detail.label === label && detail.value === normalized)) return;
    details.push({ label, value: normalized });
  };

  add('Phase', extra?.phase);
  add('Step', extra?.failedStep ?? extra?.step);
  add('Language', extra?.failedLanguage ?? extra?.languageCode);
  add('Reason', extra?.reason ?? nestedMeta?.reason);
  add('Error', extra?.error ?? nestedMeta?.error);
  add('Log path', extra?.logPath);
  add('Log directory', extra?.logDir);
  add('Workspace', extra?.workspace ?? extra?.workspaceRoot);
  add('Metadata JSON', extra?.metadataJsonPath);
  return details;
}

function collectDirectLogPathCandidates(extra: Record<string, unknown> | null | undefined): string[] {
  if (!extra) return [];
  const nestedMeta = toPlainRecord(extra.meta);
  const candidates = [
    extra.logPath,
    extra.templateLaunchLog,
    nestedMeta?.logPath,
    nestedMeta?.templateLaunchLog,
  ];
  return candidates
    .map((value) => normalizeString(value))
    .filter((value): value is string => !!value);
}

function isProjectLogPath(candidate: string, projectId: string): boolean {
  const trimmedProjectId = projectId.trim();
  if (!trimmedProjectId || !candidate.includes(trimmedProjectId)) return false;
  const base = path.basename(candidate);
  return base.endsWith('.log') || base.endsWith('.txt');
}

function isPathInsideProjectWorkspace(candidate: string, projectsWorkspace: string | null, projectId: string): boolean {
  if (!projectsWorkspace) return false;
  const projectRoot = path.resolve(projectsWorkspace, projectId);
  const resolvedCandidate = path.resolve(candidate);
  return resolvedCandidate === projectRoot || resolvedCandidate.startsWith(`${projectRoot}${path.sep}`);
}

function normalizeWorkspace(value: string | null | undefined): string | null {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  return path.isAbsolute(normalized) ? normalized : path.resolve(/* turbopackIgnore: true */ process.cwd(), normalized);
}

function parseEnvFileValue(filePath: string, key: string): string | null {
  try {
    const content = readFileSync(filePath, 'utf8');
    for (const rawLine of content.split(/\r?\n/u)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx === -1 || line.slice(0, idx).trim() !== key) continue;
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

export function resolveProjectsWorkspace(): string | null {
  const raw =
    normalizeString(process.env.DAEMON_PROJECTS_WORKSPACE)
    ?? (process.env.DAEMON_ENV_FILE ? parseEnvFileValue(path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.DAEMON_ENV_FILE), 'DAEMON_PROJECTS_WORKSPACE') : null)
    ?? parseEnvFileValue(path.resolve(/* turbopackIgnore: true */ process.cwd(), '.daemon.env'), 'DAEMON_PROJECTS_WORKSPACE');
  return normalizeWorkspace(raw);
}

async function findLatestTemplateLaunchLog(templateRoot: string): Promise<string | null> {
  const templateDirs = await readDirIfExists(templateRoot);
  let best: { path: string; mtimeMs: number } | null = null;

  for (const entry of templateDirs) {
    if (!entry.isDirectory()) continue;
    const logDir = path.join(templateRoot, entry.name, 'logs');
    const logEntries = await readDirIfExists(logDir);
    for (const logEntry of logEntries) {
      if (!logEntry.isFile() || !TEMPLATE_LAUNCH_LOG_PATTERN.test(logEntry.name)) continue;
      const logPath = path.join(logDir, logEntry.name);
      const stats = await statIfFile(logPath);
      if (!stats) continue;
      if (!best || stats.mtimeMs > best.mtimeMs) {
        best = { path: logPath, mtimeMs: stats.mtimeMs };
      }
    }
  }

  return best?.path ?? null;
}

async function readDirIfExists(dir: string): Promise<import('node:fs').Dirent[]> {
  try {
    return await fs.readdir(dir, { withFileTypes: true });
  } catch (err: any) {
    if (err?.code === 'ENOENT' || err?.code === 'ENOTDIR') return [];
    throw err;
  }
}

async function statIfFile(filePath: string): Promise<import('node:fs').Stats | null> {
  try {
    const stats = await fs.stat(filePath);
    return stats.isFile() ? stats : null;
  } catch (err: any) {
    if (err?.code === 'ENOENT' || err?.code === 'ENOTDIR') return null;
    throw err;
  }
}

async function readLogFileIfExists(
  filePath: string,
  source: ProjectErrorLogFile['source'],
  maxBytes: number,
): Promise<ProjectErrorLogFile | null> {
  const stats = await statIfFile(filePath);
  if (!stats) return null;
  const content = await readBoundedTextFile(filePath, stats.size, maxBytes);
  return {
    path: filePath,
    content,
    sizeBytes: stats.size,
    truncated: stats.size > maxBytes,
    source,
  };
}

async function readBoundedTextFile(filePath: string, sizeBytes: number, maxBytes: number): Promise<string> {
  if (sizeBytes <= maxBytes) {
    return fs.readFile(filePath, 'utf8');
  }

  const headBytes = Math.min(TRUNCATED_HEAD_BYTES, Math.floor(maxBytes / 2));
  const tailBytes = Math.max(0, maxBytes - headBytes);
  const file = await fs.open(filePath, 'r');
  try {
    const head = Buffer.alloc(headBytes);
    const tail = Buffer.alloc(tailBytes);
    const headRead = await file.read(head, 0, headBytes, 0);
    const tailRead = await file.read(tail, 0, tailBytes, Math.max(0, sizeBytes - tailBytes));
    return [
      head.subarray(0, headRead.bytesRead).toString('utf8'),
      `\n\n--- log truncated: showing first ${headRead.bytesRead} bytes and last ${tailRead.bytesRead} bytes of ${sizeBytes} bytes ---\n\n`,
      tail.subarray(0, tailRead.bytesRead).toString('utf8'),
    ].join('');
  } finally {
    await file.close();
  }
}

function normalizeMaxBytes(value: number | null | undefined): number {
  if (!Number.isFinite(value) || !value || value <= 0) return DEFAULT_ADMIN_ERROR_LOG_MAX_BYTES;
  return Math.max(1024, Math.floor(value));
}

function toPlainRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return normalizeString(value);
}
