export type ParsedAdminCharacterInfo = {
  name?: string;
  title?: string;
  slug?: string;
  bio?: string;
};

function pickFirstLocaleRecord(parsed: any): any | null {
  if (!parsed?.locales || typeof parsed.locales !== 'object') return null;
  if (parsed.locales.en && typeof parsed.locales.en === 'object') return parsed.locales.en;
  for (const value of Object.values(parsed.locales as Record<string, unknown>)) {
    if (value && typeof value === 'object') return value;
  }
  return null;
}

export function parseAdminCharacterInfoPayload(parsed: unknown): ParsedAdminCharacterInfo | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const data = parsed as any;
  const localeRecord = pickFirstLocaleRecord(data);

  const name = (localeRecord?.name ?? data?.name);
  const title = (localeRecord?.title ?? data?.title);
  const slug = data?.slug;
  const bio = (
    localeRecord?.bio
    ?? localeRecord?.shortDescription
    ?? localeRecord?.description
    ?? data?.bio
    ?? data?.shortDescription
    ?? data?.description
    ?? ''
  );

  return {
    name: typeof name === 'string' ? name : undefined,
    title: typeof title === 'string' ? title : undefined,
    slug: typeof slug === 'string' ? slug : undefined,
    bio: typeof bio === 'string' ? bio : undefined,
  };
}
