import { promises as fs } from 'fs';
import path from 'path';
import { parse as parseDotenv } from 'dotenv';

export type DoctorStatus = 'ok' | 'missing' | 'invalid' | 'unverified';

export type ExternalToolCheck = {
  tool: string;
  workspace: string;
  envPath: string;
  key: string;
  status: DoctorStatus;
  message: string;
  valuePreview?: string;
};

export type ExternalToolsDoctorReport = {
  envFile: string;
  generatedAt: string;
  checks: ExternalToolCheck[];
};

type CheckKey = {
  key: string;
  provider?: 'openrouter';
};

type ToolSpec = {
  tool: string;
  daemonEnvKey: string;
  requiredKeys: CheckKey[];
};

type DoctorOptions = {
  envFile?: string;
  cwd?: string;
  network?: boolean;
  fetchImpl?: typeof fetch;
};

const TOOL_SPECS: ToolSpec[] = [
  {
    tool: 'prompt-to-text ai-agent',
    daemonEnvKey: 'DAEMON_SCRIPT_WORKSPACE',
    requiredKeys: [{ key: 'LLM_API_KEY', provider: 'openrouter' }],
  },
  {
    tool: 'shorts tools',
    daemonEnvKey: 'DAEMON_SCRIPT_WORKSPACE_V2',
    requiredKeys: [
      { key: 'OPENROUTER_API_KEY', provider: 'openrouter' },
      { key: 'RUNWARE_API_KEY' },
      { key: 'RUNPOD_API_KEY' },
      { key: 'GEMINI_API_KEYS' },
      { key: 'MINIMAX_API_KEY' },
      { key: 'INWORLD_API_KEY_BASIC' },
      { key: 'VOICE_CLONE_RUNPOD_API_KEY' },
      { key: 'VOICE_CLONE_RUNPOD_ENDPOINT_ID' },
      { key: 'ELEVENLABS_API' },
    ],
  },
  {
    tool: 'characters lipsync',
    daemonEnvKey: 'DAEMON_CHARACTERS_WORKSPACE',
    requiredKeys: [{ key: 'RUNWARE_API_KEY' }],
  },
  {
    tool: 'caption renderer',
    daemonEnvKey: 'DAEMON_SCRIPT_CAPTION',
    requiredKeys: [{ key: 'GEMINI_API_KEY' }],
  },
];

export async function runExternalToolsDoctor(options: DoctorOptions = {}): Promise<ExternalToolsDoctorReport> {
  const cwd = options.cwd ?? process.cwd();
  const envFile = path.resolve(cwd, options.envFile ?? process.env.DAEMON_ENV_FILE ?? '.daemon.env');
  const daemonEnv = await readEnvFile(envFile);
  const checks: ExternalToolCheck[] = [];

  for (const spec of TOOL_SPECS) {
    const workspaceRaw = daemonEnv[spec.daemonEnvKey]?.trim() ?? '';
    const workspace = workspaceRaw ? resolveFrom(cwd, workspaceRaw) : '';
    if (!workspace) {
      for (const key of spec.requiredKeys) {
        checks.push({
          tool: spec.tool,
          workspace: '',
          envPath: '',
          key: key.key,
          status: 'missing',
          message: `Missing ${spec.daemonEnvKey} in ${envFile}`,
        });
      }
      continue;
    }

    const envPath = path.join(workspace, '.env');
    const toolEnv = await readEnvFileIfExists(envPath);
    if (!toolEnv) {
      for (const key of spec.requiredKeys) {
        checks.push({
          tool: spec.tool,
          workspace,
          envPath,
          key: key.key,
          status: 'missing',
          message: `Missing external tool .env at ${envPath}`,
        });
      }
      continue;
    }

    for (const key of spec.requiredKeys) {
      const raw = toolEnv[key.key]?.trim() ?? '';
      if (!raw) {
        checks.push({
          tool: spec.tool,
          workspace,
          envPath,
          key: key.key,
          status: 'missing',
          message: `Missing ${key.key} in ${envPath}`,
        });
        continue;
      }

      if (key.provider === 'openrouter') {
        const auth = await verifyOpenRouterKey(raw, {
          network: options.network ?? true,
          fetchImpl: options.fetchImpl,
        });
        checks.push({
          tool: spec.tool,
          workspace,
          envPath,
          key: key.key,
          status: auth.status,
          message: auth.message,
          valuePreview: maskSecret(raw),
        });
        continue;
      }

      checks.push({
        tool: spec.tool,
        workspace,
        envPath,
        key: key.key,
        status: 'unverified',
        message: `${key.key} is present; no non-generating auth check is configured`,
        valuePreview: maskSecret(raw),
      });
    }
  }

  return {
    envFile,
    generatedAt: new Date().toISOString(),
    checks,
  };
}

export function formatExternalToolsDoctorReport(report: ExternalToolsDoctorReport): string {
  const groups = new Map<string, ExternalToolCheck[]>();
  for (const check of report.checks) {
    const key = `${check.tool}|${check.workspace || '<missing workspace>'}`;
    groups.set(key, [...(groups.get(key) ?? []), check]);
  }
  const lines = [
    `Daemon external tools doctor`,
    `env: ${report.envFile}`,
  ];
  for (const [groupKey, checks] of groups) {
    const [tool, workspace] = groupKey.split('|');
    lines.push('', `${tool} (${workspace})`);
    for (const check of checks) {
      const preview = check.valuePreview ? ` ${check.valuePreview}` : '';
      lines.push(`- ${check.key}: ${check.status}${preview} - ${check.message}`);
    }
  }
  return lines.join('\n');
}

export function hasBlockingExternalToolIssues(report: ExternalToolsDoctorReport): boolean {
  return report.checks.some((check) => check.status === 'missing' || check.status === 'invalid');
}

async function readEnvFile(filePath: string): Promise<Record<string, string>> {
  const raw = await fs.readFile(filePath, 'utf8');
  return parseDotenv(raw);
}

async function readEnvFileIfExists(filePath: string): Promise<Record<string, string> | null> {
  try {
    return await readEnvFile(filePath);
  } catch (err: any) {
    if (err?.code === 'ENOENT') return null;
    throw err;
  }
}

function resolveFrom(cwd: string, rawPath: string): string {
  return path.isAbsolute(rawPath) ? rawPath : path.resolve(cwd, rawPath);
}

function maskSecret(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 8) return '[set]';
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

async function verifyOpenRouterKey(
  key: string,
  options: { network: boolean; fetchImpl?: typeof fetch },
): Promise<{ status: Exclude<DoctorStatus, 'missing'>; message: string }> {
  if (!options.network) {
    return { status: 'unverified', message: 'OpenRouter key is present; network auth check skipped' };
  }
  const fetcher = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetcher('https://openrouter.ai/api/v1/key', {
      method: 'GET',
      headers: { authorization: `Bearer ${key}` },
      signal: controller.signal,
    });
    if (response.ok) {
      return { status: 'ok', message: 'OpenRouter auth check passed' };
    }
    if (response.status === 401 || response.status === 403) {
      const body = await safeReadText(response);
      return {
        status: 'invalid',
        message: `OpenRouter rejected the key with ${response.status}${body ? `: ${body}` : ''}`,
      };
    }
    return {
      status: 'unverified',
      message: `OpenRouter auth endpoint returned ${response.status}; key could not be verified`,
    };
  } catch (err: any) {
    return {
      status: 'unverified',
      message: `OpenRouter auth check failed before verification: ${err?.message || String(err)}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function safeReadText(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.length > 240 ? `${text.slice(0, 240)}...` : text;
  } catch {
    return '';
  }
}
