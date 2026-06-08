import type { NextRequest } from 'next/server';

function firstHeaderValue(value: string | null) {
  return value?.split(',')[0]?.trim() || '';
}

function addUrlOrigin(candidates: Set<string>, value: string | undefined) {
  const raw = value?.trim();
  if (!raw) return;
  try {
    candidates.add(new URL(raw).origin);
  } catch {
    // Ignore malformed optional environment/header values.
  }
}

function addHost(candidates: Set<string>, value: string | null) {
  const host = firstHeaderValue(value).toLowerCase();
  if (host) candidates.add(host);
}

export function isSameSiteRequestOrigin(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (!origin) return true;

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }

  const allowedOrigins = new Set<string>();
  const allowedHosts = new Set<string>();
  addUrlOrigin(allowedOrigins, req.nextUrl.origin);
  addUrlOrigin(allowedOrigins, process.env.NEXTAUTH_URL);
  addUrlOrigin(allowedOrigins, process.env.APP_BASE_URL);
  addUrlOrigin(allowedOrigins, process.env.NEXT_PUBLIC_APP_BASE_URL);

  addHost(allowedHosts, req.nextUrl.host);
  addHost(allowedHosts, req.headers.get('host'));
  addHost(allowedHosts, req.headers.get('x-forwarded-host'));

  const forwardedProto = firstHeaderValue(req.headers.get('x-forwarded-proto'));
  const forwardedHost = firstHeaderValue(req.headers.get('x-forwarded-host')) || firstHeaderValue(req.headers.get('host'));
  if (forwardedProto && forwardedHost) {
    addUrlOrigin(allowedOrigins, `${forwardedProto}://${forwardedHost}`);
  }

  return allowedOrigins.has(originUrl.origin) || allowedHosts.has(originUrl.host.toLowerCase());
}
