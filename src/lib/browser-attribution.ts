import { readUtmSourceCookie, UTM_SOURCE_COOKIE_NAME } from '@/shared/utm/helpers';

export const BROWSER_ATTRIBUTION_STORAGE_KEY = 'yc_browser_attribution_v1';
export const BROWSER_ATTRIBUTION_COOKIE_NAME = 'yc_browser_attribution';

const MAX_FIELD_LENGTH = 300;
const ATTRIBUTION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const ATTRIBUTION_COOKIE_MAX_AGE_SECONDS = Math.floor(ATTRIBUTION_TTL_MS / 1000);
const AUTH_REFERRER_HOSTS = new Set([
  'accounts.google.com',
  'appleid.apple.com',
]);

export const ATTRIBUTION_QUERY_KEYS = [
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
  'templateId',
] as const;

export type AttributionQuery = Record<string, string | string[]>;

export type BrowserAttribution = {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  intent?: string | null;
  sourceToolSlug?: string | null;
  referrer?: string | null;
  landingPath?: string | null;
  mainPageMode?: string | null;
  mainPageCategoryId?: string | null;
  characterSlug?: string | null;
  templateId?: string | null;
  query?: AttributionQuery;
  capturedAt: string;
  updatedAt: string;
};

function cleanText(value: unknown, maxLength = MAX_FIELD_LENGTH): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\0/g, '').trim();
  if (!normalized) return null;
  return Array.from(normalized).slice(0, maxLength).join('');
}

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
  return cleanText(params.get(key));
}

export function collectAttributionQuery(params: URLSearchParams): AttributionQuery {
  const query: AttributionQuery = {};
  for (const key of ATTRIBUTION_QUERY_KEYS) {
    const values = params.getAll(key).map((value) => cleanText(value)).filter((value): value is string => !!value);
    if (values.length === 1) {
      query[key] = values[0]!;
    } else if (values.length > 1) {
      query[key] = values.slice(0, 5);
    }
  }
  return query;
}

function hasQuery(query: AttributionQuery | null | undefined): query is AttributionQuery {
  return !!query && Object.keys(query).length > 0;
}

function readStored(storage: Storage | undefined): BrowserAttribution | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(BROWSER_ATTRIBUTION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BrowserAttribution>;
    const updatedAtMs = typeof parsed.updatedAt === 'string' ? Date.parse(parsed.updatedAt) : Number.NaN;
    if (!Number.isFinite(updatedAtMs) || Date.now() - updatedAtMs > ATTRIBUTION_TTL_MS) {
      storage.removeItem(BROWSER_ATTRIBUTION_STORAGE_KEY);
      return null;
    }
    return normalizeAttribution(parsed);
  } catch {
    return null;
  }
}

export function readStoredBrowserAttribution(options: { includeLocal?: boolean } = {}): BrowserAttribution | null {
  if (typeof window === 'undefined') return null;
  let session: BrowserAttribution | null = null;
  let local: BrowserAttribution | null = null;
  try { session = readStored(window.sessionStorage); } catch {}
  if (options.includeLocal) {
    try { local = readStored(window.localStorage); } catch {}
  }
  return session ?? local;
}

function writeStored(attribution: BrowserAttribution) {
  if (typeof window === 'undefined') return;
  const serialized = JSON.stringify(attribution);
  try { window.localStorage.setItem(BROWSER_ATTRIBUTION_STORAGE_KEY, serialized); } catch {}
  try { window.sessionStorage.setItem(BROWSER_ATTRIBUTION_STORAGE_KEY, serialized); } catch {}
  writeAttributionCookie(attribution);
}

function normalizeAttribution(input: Partial<BrowserAttribution> | null | undefined): BrowserAttribution | null {
  if (!input) return null;
  const query = hasQuery(input.query) ? sanitizeQuery(input.query) : undefined;
  const normalized: BrowserAttribution = {
    utmSource: cleanText(input.utmSource) ?? null,
    utmMedium: cleanText(input.utmMedium) ?? null,
    utmCampaign: cleanText(input.utmCampaign) ?? null,
    utmContent: cleanText(input.utmContent) ?? null,
    utmTerm: cleanText(input.utmTerm) ?? null,
    intent: cleanText(input.intent, 64) ?? null,
    sourceToolSlug: cleanText(input.sourceToolSlug, 191) ?? null,
    referrer: cleanText(input.referrer, 2048) ?? null,
    landingPath: cleanText(input.landingPath, 512) ?? null,
    mainPageMode: cleanText(input.mainPageMode, 64) ?? null,
    mainPageCategoryId: cleanText(input.mainPageCategoryId, 191) ?? null,
    characterSlug: cleanText(input.characterSlug, 191) ?? null,
    templateId: cleanText(input.templateId, 191) ?? null,
    ...(hasQuery(query) ? { query } : {}),
    capturedAt: cleanText(input.capturedAt, 64) ?? new Date().toISOString(),
    updatedAt: cleanText(input.updatedAt, 64) ?? new Date().toISOString(),
  };

  if (
    !normalized.utmSource &&
    !normalized.utmMedium &&
    !normalized.utmCampaign &&
    !normalized.utmContent &&
    !normalized.utmTerm &&
    !normalized.intent &&
    !normalized.sourceToolSlug &&
    !normalized.referrer &&
    !normalized.mainPageMode &&
    !normalized.mainPageCategoryId &&
    !normalized.characterSlug &&
    !normalized.templateId &&
    !hasQuery(normalized.query)
  ) {
    return null;
  }

  return normalized;
}

function sanitizeQuery(input: AttributionQuery): AttributionQuery {
  const output: AttributionQuery = {};
  for (const [key, value] of Object.entries(input)) {
    if (!(ATTRIBUTION_QUERY_KEYS as readonly string[]).includes(key)) continue;
    if (Array.isArray(value)) {
      const values = value.map((item) => cleanText(item)).filter((item): item is string => !!item);
      if (values.length > 0) output[key] = values.slice(0, 5);
      continue;
    }
    const normalized = cleanText(value);
    if (normalized) output[key] = normalized;
  }
  return output;
}

function normalizeLandingPath(url: URL): string {
  return `${url.pathname}${url.search}${url.hash}`.slice(0, 512);
}

function inferMainPageMode(url: URL): string | null {
  const explicit = readParam(url.searchParams, 'openMode');
  if (explicit) return explicit;
  return url.pathname.startsWith('/character/') ? 'brainrot' : null;
}

function inferCharacterSlug(url: URL): string | null {
  if (!url.pathname.startsWith('/character/')) return null;
  const segment = url.pathname.split('/').filter(Boolean)[1];
  if (!segment) return null;
  try {
    return cleanText(decodeURIComponent(segment), 191);
  } catch {
    return cleanText(segment, 191);
  }
}

function buildCookiePayload(attribution: BrowserAttribution): Record<string, string> {
  const payload: Record<string, string> = {};
  const fields: Array<keyof BrowserAttribution> = [
    'utmSource',
    'utmMedium',
    'utmCampaign',
    'utmContent',
    'utmTerm',
    'intent',
    'sourceToolSlug',
    'referrer',
    'landingPath',
    'mainPageMode',
    'mainPageCategoryId',
    'characterSlug',
    'templateId',
  ];
  for (const field of fields) {
    const value = attribution[field];
    if (typeof value === 'string' && value.trim()) {
      payload[field] = value.trim();
    }
  }
  return payload;
}

function writeAttributionCookie(attribution: BrowserAttribution) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  try {
    const payload = buildCookiePayload(attribution);
    if (Object.keys(payload).length === 0) return;
    const value = encodeURIComponent(JSON.stringify(payload));
    const currentUrl = new URL(window.location.href);
    const secure = currentUrl.protocol === 'https:' ? '; secure' : '';
    const host = currentUrl.hostname.toLowerCase();
    const domain = host === 'yumcut.com' || host.endsWith('.yumcut.com') ? '; domain=.yumcut.com' : '';
    document.cookie = `${BROWSER_ATTRIBUTION_COOKIE_NAME}=${value}; path=/; max-age=${ATTRIBUTION_COOKIE_MAX_AGE_SECONDS}; samesite=lax${domain}${secure}`;
  } catch {
    // Cookie support can be disabled; local/session storage still covers client-side attempts.
  }
}

function shouldKeepReferrer(referrer: string | null, currentOrigin: string): boolean {
  if (!referrer) return false;
  try {
    const url = new URL(referrer);
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    if (url.origin === currentOrigin) return false;
    if (isAuthReferrer(referrer)) return false;
    return true;
  } catch {
    return false;
  }
}

function isAuthReferrer(referrer: string | null): boolean {
  if (!referrer) return false;
  try {
    const url = new URL(referrer);
    return AUTH_REFERRER_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function hasAttributionSignal(input: Partial<BrowserAttribution>, query: AttributionQuery): boolean {
  return Boolean(
    input.utmSource ||
    input.utmMedium ||
    input.utmCampaign ||
    input.utmContent ||
    input.utmTerm ||
    input.intent ||
    input.sourceToolSlug ||
    input.referrer ||
    input.mainPageMode ||
    input.mainPageCategoryId ||
    input.characterSlug ||
    input.templateId ||
    hasQuery(query),
  );
}

export function captureBrowserAttribution(): BrowserAttribution | null {
  if (typeof window === 'undefined') return null;

  const url = new URL(window.location.href);
  const params = url.searchParams;
  const query = collectAttributionQuery(params);
  const currentReferrer = cleanText(document.referrer, 2048);
  const stored = readStoredBrowserAttribution({ includeLocal: isAuthReferrer(currentReferrer) });
  const acceptedReferrer = shouldKeepReferrer(currentReferrer, url.origin) ? currentReferrer : null;
  const now = new Date().toISOString();
  const queryUtmSource = readParam(params, 'utm_source');
  const cookieUtmSource = readUtmSourceCookie(getCookieValue(UTM_SOURCE_COOKIE_NAME));
  const current: Partial<BrowserAttribution> = {
    utmSource: queryUtmSource ?? cookieUtmSource,
    utmMedium: readParam(params, 'utm_medium'),
    utmCampaign: readParam(params, 'utm_campaign'),
    utmContent: readParam(params, 'utm_content'),
    utmTerm: readParam(params, 'utm_term'),
    intent: readParam(params, 'intent'),
    sourceToolSlug: readParam(params, 'yc_t'),
    referrer: acceptedReferrer,
    mainPageMode: inferMainPageMode(url),
    mainPageCategoryId: readParam(params, 'openCategory'),
    characterSlug: inferCharacterSlug(url),
    templateId: readParam(params, 'templateId'),
  };
  const currentSignal: Partial<BrowserAttribution> = { ...current, utmSource: queryUtmSource };
  const hasCurrentSignal = hasAttributionSignal(currentSignal, query);
  const next = normalizeAttribution({
    utmSource: hasCurrentSignal ? (current.utmSource ?? null) : (stored?.utmSource ?? current.utmSource ?? null),
    utmMedium: hasCurrentSignal ? (current.utmMedium ?? null) : (stored?.utmMedium ?? null),
    utmCampaign: hasCurrentSignal ? (current.utmCampaign ?? null) : (stored?.utmCampaign ?? null),
    utmContent: hasCurrentSignal ? (current.utmContent ?? null) : (stored?.utmContent ?? null),
    utmTerm: hasCurrentSignal ? (current.utmTerm ?? null) : (stored?.utmTerm ?? null),
    intent: hasCurrentSignal ? (current.intent ?? null) : (stored?.intent ?? null),
    sourceToolSlug: hasCurrentSignal ? (current.sourceToolSlug ?? null) : (stored?.sourceToolSlug ?? null),
    referrer: hasCurrentSignal ? (current.referrer ?? null) : (stored?.referrer ?? null),
    landingPath: hasCurrentSignal ? normalizeLandingPath(url) : (stored?.landingPath ?? normalizeLandingPath(url)),
    mainPageMode: hasCurrentSignal ? (current.mainPageMode ?? null) : (stored?.mainPageMode ?? current.mainPageMode ?? null),
    mainPageCategoryId: hasCurrentSignal ? (current.mainPageCategoryId ?? null) : (stored?.mainPageCategoryId ?? current.mainPageCategoryId ?? null),
    characterSlug: hasCurrentSignal ? (current.characterSlug ?? null) : (stored?.characterSlug ?? current.characterSlug ?? null),
    templateId: hasCurrentSignal ? (current.templateId ?? null) : (stored?.templateId ?? current.templateId ?? null),
    query: hasQuery(query) ? query : (hasCurrentSignal ? undefined : stored?.query),
    capturedAt: stored?.capturedAt ?? now,
    updatedAt: hasCurrentSignal ? now : (stored?.updatedAt ?? now),
  });

  if (next) {
    writeStored(next);
  }

  return next;
}
