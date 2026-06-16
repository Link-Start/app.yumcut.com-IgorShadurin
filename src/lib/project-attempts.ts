import { Api } from '@/lib/api-client';
import { captureBrowserAttribution, collectAttributionQuery } from '@/lib/browser-attribution';
import { readUtmSourceCookie, UTM_SOURCE_COOKIE_NAME } from '@/shared/utm/helpers';
import type { ProjectCreationAttemptContextDTO, ProjectCreationAttemptRequestDTO } from '@/shared/types';

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
  const currentQuery = collectAttributionQuery(params);
  const attribution = captureBrowserAttribution();
  const query = Object.keys(currentQuery).length > 0 ? currentQuery : (attribution?.query ?? {});
  const queryToolSlug = typeof query.yc_t === 'string' ? query.yc_t : null;
  const inferredMainPageMode = url.pathname.startsWith('/character/')
    ? 'brainrot'
    : (readParam(params, 'openMode') ?? 'stories');
  const rawContext: Record<string, unknown> = {
    path: url.pathname,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    userAgent: navigator.userAgent,
  };
  if (attribution) {
    rawContext.attribution = attribution;
  }

  return {
    utmSource: readParam(params, 'utm_source') ?? attribution?.utmSource ?? readUtmSourceCookie(getCookieValue(UTM_SOURCE_COOKIE_NAME)),
    utmMedium: readParam(params, 'utm_medium') ?? attribution?.utmMedium ?? null,
    utmCampaign: readParam(params, 'utm_campaign') ?? attribution?.utmCampaign ?? null,
    utmContent: readParam(params, 'utm_content') ?? attribution?.utmContent ?? null,
    utmTerm: readParam(params, 'utm_term') ?? attribution?.utmTerm ?? null,
    intent: readParam(params, 'intent') ?? attribution?.intent ?? null,
    sourceToolSlug: overrides.sourceToolSlug ?? queryToolSlug ?? attribution?.sourceToolSlug ?? null,
    referrer: attribution?.referrer ?? null,
    landingPath: attribution?.landingPath ?? url.pathname,
    query,
    rawContext,
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
