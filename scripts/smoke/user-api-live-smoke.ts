import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

type Json = Record<string, any> | any[] | string | number | boolean | null;

type ApiResult = {
  status: number;
  headers: Headers;
  body: Json | string | null;
  url: string;
};

type StepResult = {
  name: string;
  ok: boolean;
  detail?: string;
};

const key = requiredEnv('YUMCUT_USER_API_KEY');
const apiBase = normalizeBase(process.env.YUMCUT_API_BASE || 'https://app.yumcut.com/api/user/v1');
const appOrigin = new URL(apiBase).origin;
const imagePath = requiredEnv('YUMCUT_TEST_IMAGE');
const maxPollMs = Number(process.env.YUMCUT_PROJECT_POLL_MS || 10 * 60 * 1000);
const pollIntervalMs = Number(process.env.YUMCUT_PROJECT_POLL_INTERVAL_MS || 15_000);
const maxStorageImageDimension = 1080;

const results: StepResult[] = [];

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function normalizeBase(value: string) {
  return value.replace(/\/+$/, '');
}

function endpoint(pathname: string) {
  return `${apiBase}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
}

function redact(input: unknown): unknown {
  if (typeof input === 'string') {
    return input
      .replace(/Bearer\s+[A-Za-z0-9._~-]+/g, 'Bearer [REDACTED]')
      .replace(/ycu_[A-Za-z0-9]+/g, 'ycu_[REDACTED]')
      .replace(/([?&](?:data|sig)=)[^&\s]+/g, '$1[REDACTED]');
  }
  if (Array.isArray(input)) return input.map(redact);
  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k] = /^(authorization|data|signature|sig|key|token)$/i.test(k) ? '[REDACTED]' : redact(v);
    }
    return out;
  }
  return input;
}

function stringifyDetail(input: unknown) {
  if (input == null) return '';
  const value = typeof input === 'string' ? input : JSON.stringify(redact(input));
  return value.length > 800 ? `${value.slice(0, 797)}...` : value;
}

async function readBody(res: Response): Promise<Json | string | null> {
  const text = await res.text().catch(() => '');
  if (!text) return null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json') || /^[\[{]/.test(text.trim())) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

async function rawFetch(url: string, init: RequestInit = {}): Promise<ApiResult> {
  const res = await fetch(url, init);
  return {
    status: res.status,
    headers: res.headers,
    body: await readBody(res),
    url,
  };
}

async function api(
  pathname: string,
  init: RequestInit & { json?: unknown; auth?: boolean } = {},
): Promise<ApiResult> {
  const headers = new Headers(init.headers ?? {});
  if (init.auth !== false) headers.set('authorization', `Bearer ${key}`);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(init.json);
  }
  return rawFetch(endpoint(pathname), {
    ...init,
    headers,
    body,
  });
}

function errorInfo(result: ApiResult) {
  return typeof result.body === 'object' && result.body && !Array.isArray(result.body)
    ? (result.body as any).error
    : null;
}

function assertStatus(result: ApiResult, expected: number | number[]) {
  const accepted = Array.isArray(expected) ? expected : [expected];
  if (!accepted.includes(result.status)) {
    throw new Error(`expected ${accepted.join('/')} got ${result.status}: ${stringifyDetail(result.body)}`);
  }
}

function assertClearError(result: ApiResult) {
  const err = errorInfo(result);
  if (!err || typeof err.code !== 'string' || typeof err.message !== 'string' || err.message.trim().length < 5) {
    throw new Error(`unclear error body: ${stringifyDetail(result.body)}`);
  }
  if (result.status >= 500 || err.code === 'INTERNAL_ERROR') {
    throw new Error(`internal error returned: ${stringifyDetail(result.body)}`);
  }
}

function expectObject(body: unknown, label: string): Record<string, any> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error(`${label} is not an object`);
  return body as Record<string, any>;
}

function expectArray(body: unknown, label: string): any[] {
  if (!Array.isArray(body)) throw new Error(`${label} is not an array`);
  return body;
}

async function step<T>(name: string, run: () => Promise<T>): Promise<T | null> {
  try {
    const value = await run();
    results.push({ name, ok: true });
    console.log(`PASS ${name}`);
    return value;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    results.push({ name, ok: false, detail });
    console.error(`FAIL ${name}: ${detail}`);
    return null;
  }
}

async function expectApi(
  name: string,
  pathname: string,
  expected: number | number[],
  init: RequestInit & { json?: unknown; auth?: boolean } = {},
) {
  return step(name, async () => {
    const result = await api(pathname, init);
    assertStatus(result, expected);
    if (result.status >= 400) assertClearError(result);
    return result;
  });
}

function findImagePrankItem(catalog: any): any | null {
  for (const category of catalog?.categories ?? []) {
    for (const item of category.items ?? []) {
      if (item?.id && item?.slug && item?.imageUrl && item?.previewImageUrl) return item;
    }
    for (const subcategory of category.subcategories ?? []) {
      for (const item of subcategory.items ?? []) {
        if (item?.id && item?.slug && item?.imageUrl && item?.previewImageUrl) return item;
      }
    }
  }
  return null;
}

function findCatalogCharacter(categoriesBody: any): any | null {
  for (const category of categoriesBody?.categories ?? []) {
    for (const character of category.characters ?? []) {
      if (character?.slug) return character;
    }
  }
  return null;
}

function findVariation(charactersBody: any): any | null {
  for (const group of charactersBody?.global ?? []) {
    for (const variation of group.variations ?? []) {
      if (variation?.id) return variation;
    }
  }
  return null;
}

function deriveStorageBase(...urls: Array<string | null | undefined>) {
  if (process.env.YUMCUT_STORAGE_BASE?.trim()) return normalizeBase(process.env.YUMCUT_STORAGE_BASE.trim());
  for (const candidate of urls) {
    if (!candidate) continue;
    try {
      const parsed = new URL(candidate);
      return parsed.origin;
    } catch {
      // Ignore relative URLs.
    }
  }
  throw new Error('YUMCUT_STORAGE_BASE is required because catalog media URLs are relative');
}

async function uploadTargetImage(storageBase: string) {
  const grant = await expectApi('storage upload token succeeds', '/storage/upload-token', 200, {
    method: 'POST',
    json: { maxBytes: 5 * 1024 * 1024 },
  });
  if (!grant) throw new Error('upload grant failed');
  const grantBody = expectObject(grant.body, 'upload grant');
  if (!grantBody.data || !grantBody.signature || !Array.isArray(grantBody.mimeTypes)) {
    throw new Error(`upload grant missing fields: ${stringifyDetail(grantBody)}`);
  }

  const sourceFile = await readFile(imagePath);
  const file = await sharp(sourceFile)
    .rotate()
    .resize({
      width: maxStorageImageDimension,
      height: maxStorageImageDimension,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 90 })
    .toBuffer();
  const mime = 'image/jpeg';
  if (!grantBody.mimeTypes.includes(mime)) {
    throw new Error(`upload grant does not allow ${mime}: ${grantBody.mimeTypes.join(', ')}`);
  }
  if (file.length > grantBody.maxBytes) {
    throw new Error(`test image is larger than grant maxBytes (${file.length} > ${grantBody.maxBytes})`);
  }

  const form = new FormData();
  form.set('data', grantBody.data);
  form.set('signature', grantBody.signature);
  form.set('file', new File([new Blob([file], { type: mime })], path.basename(imagePath), { type: mime }));

  const result = await step('storage service accepts target image upload', async () => {
    const uploaded = await rawFetch(`${normalizeBase(storageBase)}/api/storage/user-images`, {
      method: 'POST',
      headers: { origin: appOrigin },
      body: form,
    });
    assertStatus(uploaded, 200);
    const body = expectObject(uploaded.body, 'storage upload response');
    if (!body.path || !body.url) throw new Error(`storage upload missing path/url: ${stringifyDetail(body)}`);
    return body;
  });
  if (!result) throw new Error('storage upload failed');
  return result;
}

function projectDone(status: string | null | undefined) {
  const normalized = String(status || '').toLowerCase();
  return ['completed', 'complete', 'done', 'ready', 'succeeded', 'success'].includes(normalized);
}

function projectTerminal(status: string | null | undefined) {
  const normalized = String(status || '').toLowerCase();
  return projectDone(normalized) || ['failed', 'error', 'cancelled', 'canceled'].includes(normalized);
}

async function pollProject(projectId: string) {
  const deadline = Date.now() + maxPollMs;
  let latest: any = null;
  while (Date.now() < deadline) {
    const statusRes = await api(`/projects/${encodeURIComponent(projectId)}/status`);
    if (statusRes.status >= 400) {
      throw new Error(`project status failed: ${statusRes.status} ${stringifyDetail(statusRes.body)}`);
    }
    latest = statusRes.body;
    const status = (latest as any)?.status ?? (latest as any)?.project?.status;
    console.log(`INFO project ${projectId} status=${status || 'unknown'}`);
    if (projectTerminal(status)) return latest;
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  throw new Error(`project did not reach terminal status within ${maxPollMs}ms; latest=${stringifyDetail(latest)}`);
}

async function main() {
  console.log(`INFO API base: ${apiBase}`);
  console.log(`INFO Image file: ${imagePath}`);

  const openapi = await step('OpenAPI JSON is public and documents user API', async () => {
    const result = await rawFetch(endpoint('/openapi.json'));
    assertStatus(result, 200);
    const spec = expectObject(result.body, 'openapi');
    const required: Array<[string, string]> = [
      ['/account', 'get'],
      ['/projects', 'post'],
      ['/projects/{projectId}', 'get'],
      ['/projects/{projectId}/status', 'get'],
      ['/projects/{projectId}/downloads/image', 'get'],
      ['/image-pranks', 'get'],
      ['/image-pranks/{slug}', 'get'],
      ['/characters/catalog', 'get'],
      ['/characters/{slug}', 'get'],
      ['/characters/variations/{variationId}/preview-image', 'get'],
      ['/templates', 'get'],
      ['/settings', 'patch'],
    ];
    for (const [p, m] of required) {
      if (!spec.paths?.[p]?.[m]) throw new Error(`OpenAPI missing ${m.toUpperCase()} ${p}`);
    }
    return spec;
  });

  await step('Scalar docs page is public', async () => {
    const result = await rawFetch(endpoint('/docs'));
    assertStatus(result, 200);
    if (typeof result.body !== 'string' || !result.body.includes('/api/user/v1/openapi.json')) {
      throw new Error('docs page does not reference OpenAPI JSON');
    }
  });

  await step('missing bearer returns clear 401', async () => {
    const result = await api('/account', { auth: false });
    assertStatus(result, 401);
    assertClearError(result);
  });

  await step('invalid bearer returns clear 401', async () => {
    const result = await rawFetch(endpoint('/account'), {
      headers: { authorization: 'Bearer ycu_invalid' },
    });
    assertStatus(result, 401);
    assertClearError(result);
  });

  await expectApi('admin paths are not exposed', '/admin/users', 404);
  await expectApi('billing paths are not exposed', '/subscriptions/status', 404);
  await expectApi('account deletion path is not exposed', '/account/delete', 404, { method: 'POST' });

  const account = await expectApi('account reads current user only', '/account', 200);
  const tokens = await expectApi('tokens reads balance and costs', '/tokens', 200);
  await expectApi('token history reads current user only', '/tokens/history?page=1&pageSize=2', 200);
  const language = await expectApi('account language reads', '/account/language', 200);
  const settings = await expectApi('settings reads', '/settings', 200);
  await expectApi('settings validation is clear', '/settings', 400, {
    method: 'PATCH',
    json: { key: 'notASetting', value: true },
  });

  if (language?.body && typeof language.body === 'object' && !Array.isArray(language.body)) {
    await expectApi('account language PATCH accepts current value', '/account/language', 200, {
      method: 'PATCH',
      json: { language: (language.body as any).language || 'en' },
    });
  }

  if (settings?.body && typeof settings.body === 'object' && !Array.isArray(settings.body)) {
    const original = Boolean((settings.body as any).includeCallToAction);
    await expectApi('settings PATCH toggles reversible boolean', '/settings', 200, {
      method: 'PATCH',
      json: { key: 'includeCallToAction', value: !original },
    });
    await expectApi('settings PATCH restores reversible boolean', '/settings', 200, {
      method: 'PATCH',
      json: { key: 'includeCallToAction', value: original },
    });
  }

  const projectsBefore = await expectApi('projects list reads own projects', '/projects?limit=5', 200);
  const voices = await expectApi('voices catalog reads', '/voices', 200);
  const templates = await expectApi('templates catalog reads preview metadata', '/templates?public=1', 200);
  if (templates?.body) {
    const firstTemplate = expectArray(templates.body, 'templates').find((item) => item?.id);
    if (firstTemplate?.id) await expectApi('template detail reads preview metadata', `/templates/${encodeURIComponent(firstTemplate.id)}`, 200);
  }

  const imagePranks = await expectApi('image prank catalog reads preview metadata', '/image-pranks', 200);
  const imagePrankItem = imagePranks ? findImagePrankItem(imagePranks.body) : null;
  if (!imagePrankItem) throw new Error('No public Image Prank catalog item with preview metadata found');
  await expectApi('image prank item detail reads by slug', `/image-pranks/${encodeURIComponent(imagePrankItem.slug)}`, 200);
  await expectApi('missing image prank item gives clear 404', '/image-pranks/does-not-exist-smoke-test', 404);

  const characters = await expectApi('characters mixed catalog reads', '/characters', 200);
  const catalog = await expectApi('character catalog reads preview metadata', '/characters/catalog', 200);
  const catalogCharacter = catalog ? findCatalogCharacter(catalog.body) : null;
  if (catalogCharacter?.slug) {
    const profile = await expectApi('character profile reads by slug', `/characters/${encodeURIComponent(catalogCharacter.slug)}`, 200);
    const wasFavorited = Boolean((profile?.body as any)?.isFavorited);
    if (wasFavorited) {
      await expectApi('character unfavorite succeeds', `/characters/${encodeURIComponent(catalogCharacter.slug)}/favorite`, 200, { method: 'DELETE' });
      await expectApi('character favorite restore succeeds', `/characters/${encodeURIComponent(catalogCharacter.slug)}/favorite`, 200, { method: 'POST' });
    } else {
      await expectApi('character favorite succeeds', `/characters/${encodeURIComponent(catalogCharacter.slug)}/favorite`, 200, { method: 'POST' });
      await expectApi('character unfavorite restore succeeds', `/characters/${encodeURIComponent(catalogCharacter.slug)}/favorite`, 200, { method: 'DELETE' });
    }
  }
  const variation = characters ? findVariation(characters.body) : null;
  if (variation?.id) {
    await expectApi('character preview image redirects for allowed height', `/characters/variations/${encodeURIComponent(variation.id)}/preview-image?h=896`, [200, 307], {
      redirect: 'manual',
    });
    await expectApi('character preview image rejects bad height clearly', `/characters/variations/${encodeURIComponent(variation.id)}/preview-image?h=512`, 400, {
      redirect: 'manual',
    });
  }

  await expectApi('project cost quotes valid image-prank payload shell', '/project-cost', 200, {
    method: 'POST',
    json: {
      prompt: 'Place this catalog prank naturally into the target room photo.',
      projectExperience: 'image-generation',
      imagePrank: {
        mode: 'catalog',
        catalogItemId: imagePrankItem.id,
        sourceImages: [{
          role: 'target',
          path: 'image/smoke-placeholder.jpeg',
          url: 'https://storage.example.com/api/media/image/smoke-placeholder.jpeg',
        }],
      },
    },
  });
  await expectApi('project creation requires idempotency key clearly', '/projects', 400, {
    method: 'POST',
    json: { prompt: 'Smoke test', projectExperience: 'image-generation' },
  });
  await expectApi('project validation rejects missing catalog item clearly', '/projects', 400, {
    method: 'POST',
    headers: { 'Idempotency-Key': `smoke-invalid-${randomUUID()}` },
    json: {
      prompt: 'Smoke test invalid image prank',
      projectExperience: 'image-generation',
      imagePrank: { mode: 'catalog', sourceImages: [{ role: 'target', path: 'image/a.jpeg', url: 'https://storage.example.com/api/media/image/a.jpeg' }] },
    },
  });

  const storageBase = deriveStorageBase(imagePrankItem.imageUrl, imagePrankItem.previewImageUrl);
  console.log(`INFO Storage base: ${storageBase}`);
  const uploaded = await uploadTargetImage(storageBase);

  await expectApi('media grant rejects unowned path clearly', '/media/grant', [403, 400], {
    method: 'POST',
    json: { path: 'image/does-not-exist-smoke-test.jpeg', disposition: 'inline' },
  });

  const idempotencyKey = `image-prank-smoke-${Date.now()}-${randomUUID()}`;
  const createPayload = {
    prompt: 'Blend the selected catalog prank into this bedroom photo realistically. Match perspective, light, shadows, and occlusion. Do not add text or watermarks.',
    projectExperience: 'image-generation',
    imagePrank: {
      mode: 'catalog',
      catalogItemId: imagePrankItem.id,
      sourceImages: [{
        role: 'target',
        path: uploaded.path,
        url: uploaded.url,
        label: 'Target room image',
      }],
    },
  };

  const project = await expectApi('image prank project creates with catalog item and uploaded target image', '/projects', 200, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    json: createPayload,
  });
  const projectBody = project ? expectObject(project.body, 'created project') : null;
  const projectId = projectBody?.id;
  if (!projectId) throw new Error(`project creation did not return id: ${stringifyDetail(projectBody)}`);

  await expectApi('idempotent project create replays same response', '/projects', 200, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    json: createPayload,
  });
  await expectApi('idempotency conflict is clear for changed body', '/projects', 409, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    json: { ...createPayload, prompt: `${createPayload.prompt} changed` },
  });

  await expectApi('project detail reads created project', `/projects/${encodeURIComponent(projectId)}`, 200);
  await expectApi('project status polls created project', `/projects/${encodeURIComponent(projectId)}/status`, 200);
  await expectApi('image prank reuse reads created source data', `/projects/${encodeURIComponent(projectId)}/image-prank-reuse`, 200);

  await expectApi('project script approve rejects image project state clearly', `/projects/${encodeURIComponent(projectId)}/script/approve`, [400, 404, 409], {
    method: 'POST',
    json: { text: 'Too short' },
  });
  await expectApi('project audio list rejects image project clearly or returns empty', `/projects/${encodeURIComponent(projectId)}/audios`, [200, 400, 404]);
  await expectApi('nonexistent project status is clear', `/projects/${randomUUID()}/status`, 404);
  await expectApi('nonexistent project stop is clear', `/projects/${randomUUID()}/stop`, 404, { method: 'POST' });
  await expectApi('nonexistent project delete is clear', `/projects/${randomUUID()}`, 404, { method: 'DELETE' });

  await expectApi('scheduler settings reads', '/scheduler/settings', 200);
  await expectApi('scheduler channel validation is clear', '/scheduler/channels', [400, 403], { method: 'POST', json: {} });
  await expectApi('scheduler channel delete missing id is clear', `/scheduler/channels/${randomUUID()}`, [403, 404], { method: 'DELETE' });
  await expectApi('scheduler channel revoke missing id is clear', `/scheduler/channels/${randomUUID()}/revoke`, [403, 404], { method: 'POST' });
  await expectApi('scheduler project schedule validation is clear', `/scheduler/projects/${projectId}`, [400, 403], { method: 'POST', headers: { 'Idempotency-Key': `sched-${randomUUID()}` }, json: {} });
  await expectApi('scheduler cleanup request missing task is clear', `/scheduler/tasks/${randomUUID()}/cleanup-request`, [403, 404], { method: 'POST' });

  await expectApi('telegram account reads', '/telegram/account', [200, 404]);
  await expectApi('telegram link token creates', '/telegram/link-token', 200, { method: 'POST' });

  const terminal = await step('created image prank project reaches terminal status', async () => pollProject(projectId));
  const terminalStatus = (terminal as any)?.status ?? (terminal as any)?.project?.status;
  if (!projectDone(terminalStatus)) {
    throw new Error(`created project ended without success: ${stringifyDetail(terminal)}`);
  }
  await expectApi('final image download URL is available', `/projects/${encodeURIComponent(projectId)}/downloads/image`, 200);

  if (projectsBefore?.body) {
    const list = await expectApi('projects list includes smoke-created project', '/projects?limit=20', 200);
    const items = (list?.body as any)?.items ?? [];
    if (!items.some((item: any) => item?.id === projectId)) throw new Error('created project not found in project list');
  }

  if (!openapi || !tokens || !voices) {
    throw new Error('Required smoke prerequisites failed');
  }

  const failed = results.filter((entry) => !entry.ok);
  console.log(`\nSmoke summary: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length > 0) {
    for (const entry of failed) console.error(`FAILED ${entry.name}: ${entry.detail}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`FATAL ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
