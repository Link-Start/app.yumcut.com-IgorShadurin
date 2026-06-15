import { Api } from '@/lib/api-client';
import { readUtmSourceCookie, UTM_SOURCE_COOKIE_NAME } from '@/shared/utm/helpers';
import type { ProjectCreationAttemptContextDTO, ProjectCreationAttemptRequestDTO } from '@/shared/types';

const QUERY_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'intent',
  'yc_t',
  'yc_l',
  'yc_v',
  'yc_d',
  'openMode',
  'openCategory',
  'page',
  'lang',
] as const;

function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const prefix = `${name}=`;
    const cookie = document.cookie.split('; ').find((entry) => entry.startsWith(prefix));
    return cookie ? cookie.slice(prefix.length) : null;
  } catch {
    return null;
  }
}

function readParam(params: URLSearchParams, key: string): string | null {
  const value = params.get(key)?.trim() ?? '';
  return value || null;
}

function collectQuery(params: URLSearchParams): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};
  for (const key of QUERY_KEYS) {
    const values = params.getAll(key).map((value) => value.trim()).filter(Boolean);
    if (values.length === 1) {
      query[key] = values[0]!;
    } else if (values.length > 1) {
      query[key] = values.slice(0, 5);
    }
  }
  return query;
}

export function createProjectAttemptClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function collectProjectAttemptContext(overrides: {
  sourceToolSlug?: string | null;
  mainPageMode?: string | null;
  mainPageCategoryId?: string | null;
  characterSlug?: string | null;
  templateId?: string | null;
} = {}): ProjectCreationAttemptContextDTO & {
  mainPageMode?: string | null;
  mainPageCategoryId?: string | null;
  characterSlug?: string | null;
  templateId?: string | null;
} {
  if (typeof window === 'undefined') {
    return overrides;
  }

  const url = new URL(window.location.href);
  const params = url.searchParams;
  const query = collectQuery(params);
  const queryToolSlug = typeof query.yc_t === 'string' ? query.yc_t : null;
  const inferredMainPageMode = url.pathname.startsWith('/character/')
    ? 'brainrot'
    : (readParam(params, 'openMode') ?? 'stories');

  return {
    utmSource: readParam(params, 'utm_source') ?? readUtmSourceCookie(getCookieValue(UTM_SOURCE_COOKIE_NAME)),
    utmMedium: readParam(params, 'utm_medium'),
    utmCampaign: readParam(params, 'utm_campaign'),
    utmContent: readParam(params, 'utm_content'),
    utmTerm: readParam(params, 'utm_term'),
    intent: readParam(params, 'intent'),
    sourceToolSlug: overrides.sourceToolSlug ?? queryToolSlug,
    referrer: document.referrer || null,
    landingPath: url.pathname,
    query,
    rawContext: {
      path: url.pathname,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      userAgent: navigator.userAgent,
    },
    mainPageMode: overrides.mainPageMode ?? inferredMainPageMode,
    mainPageCategoryId: overrides.mainPageCategoryId ?? readParam(params, 'openCategory'),
    characterSlug: overrides.characterSlug ?? null,
    templateId: overrides.templateId ?? null,
  };
}

export async function recordProjectCreationAttemptFromClient(payload: ProjectCreationAttemptRequestDTO) {
  try {
    return await Api.recordProjectCreationAttempt(payload);
  } catch (error) {
    console.error('Failed to record project creation attempt', error);
    return null;
  }
}
