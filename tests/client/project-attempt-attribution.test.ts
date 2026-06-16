import { afterEach, describe, expect, it } from 'vitest';
import { BROWSER_ATTRIBUTION_STORAGE_KEY, captureBrowserAttribution } from '@/lib/browser-attribution';
import { collectProjectAttemptContext } from '@/lib/project-attempts';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

function installBrowser(params: {
  href: string;
  referrer?: string;
  localStorage?: MemoryStorage;
  sessionStorage?: MemoryStorage;
}) {
  const localStorage = params.localStorage ?? new MemoryStorage();
  const sessionStorage = params.sessionStorage ?? new MemoryStorage();
  (globalThis as any).window = {
    location: { href: params.href },
    localStorage,
    sessionStorage,
    innerWidth: 390,
    innerHeight: 844,
  };
  (globalThis as any).document = {
    referrer: params.referrer ?? '',
    cookie: '',
  };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { userAgent: 'vitest' },
  });
  return { localStorage, sessionStorage };
}

describe('project attempt browser attribution', () => {
  afterEach(() => {
    delete (globalThis as any).window;
    delete (globalThis as any).document;
    delete (globalThis as any).navigator;
  });

  it('keeps the original external tool attribution after OAuth returns from Google', () => {
    const storage = installBrowser({
      href: 'https://app.yumcut.com/?yc_t=church-tool&utm_source=yumcut-tool',
      referrer: 'https://yumcut.com/tools/church',
    });
    captureBrowserAttribution();
    expect(storage.localStorage.getItem(BROWSER_ATTRIBUTION_STORAGE_KEY)).toContain('church-tool');

    installBrowser({
      href: 'https://app.yumcut.com/',
      referrer: 'https://accounts.google.com/',
      localStorage: storage.localStorage,
      sessionStorage: storage.sessionStorage,
    });
    const context = collectProjectAttemptContext();

    expect(context.sourceToolSlug).toBe('church-tool');
    expect(context.utmSource).toBe('yumcut-tool');
    expect(context.referrer).toBe('https://yumcut.com/tools/church');
    expect(context.landingPath).toBe('/?yc_t=church-tool&utm_source=yumcut-tool');
  });

  it('does not report auth provider referrers when there is no stored source', () => {
    installBrowser({
      href: 'https://app.yumcut.com/',
      referrer: 'https://accounts.google.com/',
    });

    const context = collectProjectAttemptContext();

    expect(context.sourceToolSlug).toBeNull();
    expect(context.utmSource).toBeNull();
    expect(context.referrer).toBeNull();
    expect(context.landingPath).toBe('/');
  });

  it('does not reuse persistent attribution on a later direct visit without source signals', () => {
    const oldLocalStorage = new MemoryStorage();
    oldLocalStorage.setItem(BROWSER_ATTRIBUTION_STORAGE_KEY, JSON.stringify({
      sourceToolSlug: 'old-tool',
      referrer: 'https://old.example/source',
      landingPath: '/?yc_t=old-tool',
      capturedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    installBrowser({
      href: 'https://app.yumcut.com/',
      localStorage: oldLocalStorage,
    });

    const context = collectProjectAttemptContext();

    expect(context.sourceToolSlug).toBeNull();
    expect(context.referrer).toBeNull();
    expect(context.landingPath).toBe('/');
  });

  it('captures external referrers even without UTM parameters', () => {
    installBrowser({
      href: 'https://app.yumcut.com/character/newton',
      referrer: 'https://example.org/posts/video-idea',
    });

    const context = collectProjectAttemptContext();

    expect(context.referrer).toBe('https://example.org/posts/video-idea');
    expect(context.landingPath).toBe('/character/newton');
    expect(context.mainPageMode).toBe('brainrot');
  });
});
