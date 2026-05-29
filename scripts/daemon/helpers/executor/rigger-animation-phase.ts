import { ProjectStatus } from '@/shared/constants/status';
import { setStatus } from '../db';
import { log } from '../logger';
import type { DaemonConfig } from '../config';
import type { CreationSnapshot } from './types';

type RiggerAnimationPhaseArgs = {
  projectId: string;
  cfg: CreationSnapshot;
  jobPayload: Record<string, unknown>;
  daemonConfig: DaemonConfig;
};

export async function handleRiggerAnimationPhase({ projectId, cfg, jobPayload, daemonConfig }: RiggerAnimationPhaseArgs) {
  if (!daemonConfig.riggerRunpodEndpoint) {
    throw new Error('DAEMON_RIGGER_RUNPOD_ENDPOINT is not configured');
  }

  const serverlessInput = buildServerlessInput(projectId, cfg, jobPayload, daemonConfig.apiBaseUrl);
  await setStatus(projectId, ProjectStatus.ProcessVideoMain, 'Rigger animation submitted', {
    source: 'rigger-animation',
    mode: serverlessInput.mode,
    requestId: serverlessInput.requestId,
  });

  const response = await fetch(daemonConfig.riggerRunpodEndpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(daemonConfig.riggerRunpodApiKey ? { authorization: `Bearer ${daemonConfig.riggerRunpodApiKey}` } : {}),
    },
    body: JSON.stringify({ input: serverlessInput }),
  });
  const payload = await response.json().catch(async () => ({ raw: await response.text().catch(() => '') }));
  if (!response.ok) {
    throw new Error(`Rigger RunPod request failed ${response.status}: ${JSON.stringify(payload)}`);
  }
  const output = (payload as any)?.output ?? payload;
  if (output?.ok === false) {
    throw new Error(output?.error || 'Rigger animation failed');
  }

  log.info('Rigger animation serverless job completed', {
    projectId,
    requestId: serverlessInput.requestId,
    mode: serverlessInput.mode,
  });
  await setStatus(projectId, ProjectStatus.Done, 'Rigger animation completed', {
    source: 'rigger-animation',
    requestId: serverlessInput.requestId,
    mode: serverlessInput.mode,
    serverless: output,
  });
}

function buildServerlessInput(
  projectId: string,
  cfg: CreationSnapshot,
  jobPayload: Record<string, unknown>,
  apiBaseUrl: string,
) {
  const raw = ((jobPayload as any).serverlessInput ?? (jobPayload as any).riggerAnimation ?? jobPayload) as Record<string, unknown>;
  const requestId = String((raw as any).requestId || `${projectId}-rigger-animation`);
  const mode = String((raw as any).mode || 'text-to-animation');
  return {
    ...raw,
    schemaVersion: (raw as any).schemaVersion ?? 1,
    requestId,
    projectId,
    mode,
    returnMode: (raw as any).returnMode ?? 'hook',
    hooks: {
      ...((raw as any).hooks && typeof (raw as any).hooks === 'object' ? (raw as any).hooks : {}),
      success: (raw as any)?.hooks?.success ?? `${apiBaseUrl.replace(/\/+$/, '')}/api/rigger-animation/callback`,
      error: (raw as any)?.hooks?.error ?? `${apiBaseUrl.replace(/\/+$/, '')}/api/rigger-animation/callback`,
    },
    speech: (raw as any).speech ?? {
      text: String((raw as any).text || ''),
    },
  };
}
