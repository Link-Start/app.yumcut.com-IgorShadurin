import { getResendClient } from '@/server/emails/resend';

const GUEST_EMAIL_SUFFIX = '@guest.yumcut';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let cachedAudienceId: string | null | undefined;

export type ResendContactUserInput = {
  userId?: string | null;
  email?: string | null;
  name?: string | null;
  isGuest?: boolean | null;
  deleted?: boolean | null;
};

export type ResendContactSyncResult = {
  status: 'created' | 'existing' | 'removed' | 'not_found' | 'skipped';
  email?: string;
  audienceId?: string | null;
  reason?: string;
};

export function normalizeResendContactEmail(email?: string | null): string | null {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.endsWith(GUEST_EMAIL_SUFFIX)) return null;
  if (!EMAIL_PATTERN.test(normalized)) return null;
  return normalized;
}

export async function addUserToResendContacts(input: ResendContactUserInput): Promise<ResendContactSyncResult> {
  if (input.deleted) return { status: 'skipped', reason: 'deleted_user' };
  if (input.isGuest) return { status: 'skipped', reason: 'guest_user' };

  const email = normalizeResendContactEmail(input.email);
  if (!email) return { status: 'skipped', reason: 'invalid_or_guest_email' };

  const resend = getOptionalResendClient();
  if (!resend) return { status: 'skipped', email, reason: 'resend_not_configured' };

  const audienceId = await resolveResendAudienceId(resend);
  const nameParts = splitContactName(input.name);
  const payload: Record<string, unknown> = {
    email,
    ...nameParts,
  };
  if (audienceId) {
    payload.audienceId = audienceId;
  }

  const response = await resend.contacts.create(payload as any);
  if (response.error) {
    if (isDuplicateContactError(response.error)) {
      return { status: 'existing', email, audienceId };
    }
    throw new Error(`Resend contact create failed for ${email}: ${formatResendError(response.error)}`);
  }

  return { status: 'created', email, audienceId };
}

export async function removeUserFromResendContacts(input: ResendContactUserInput): Promise<ResendContactSyncResult> {
  const email = normalizeResendContactEmail(input.email);
  if (!email) return { status: 'skipped', reason: 'invalid_or_guest_email' };

  const resend = getOptionalResendClient();
  if (!resend) return { status: 'skipped', email, reason: 'resend_not_configured' };

  const audienceId = await resolveResendAudienceId(resend);
  let removed = false;
  let notFound = false;

  if (audienceId) {
    const response = await resend.contacts.remove({ audienceId, email } as any);
    if (response.error) {
      if (isNotFoundContactError(response.error)) {
        notFound = true;
      } else {
        throw new Error(`Resend audience contact remove failed for ${email}: ${formatResendError(response.error)}`);
      }
    } else {
      removed = true;
    }
  }

  const globalResponse = await resend.contacts.remove({ email } as any);
  if (globalResponse.error) {
    if (isNotFoundContactError(globalResponse.error)) {
      notFound = true;
    } else {
      throw new Error(`Resend contact remove failed for ${email}: ${formatResendError(globalResponse.error)}`);
    }
  } else {
    removed = true;
  }

  return {
    status: removed ? 'removed' : notFound ? 'not_found' : 'skipped',
    email,
    audienceId,
    reason: removed ? undefined : 'contact_not_found',
  };
}

export function addUserToResendContactsInBackground(input: ResendContactUserInput, context: string) {
  addUserToResendContacts(input).catch((err) => {
    console.error('Failed to add user email to Resend contacts', {
      context,
      userId: input.userId,
      email: input.email,
      err,
    });
  });
}

export function removeUserFromResendContactsInBackground(input: ResendContactUserInput, context: string) {
  removeUserFromResendContacts(input).catch((err) => {
    console.error('Failed to remove user email from Resend contacts', {
      context,
      userId: input.userId,
      email: input.email,
      err,
    });
  });
}

function getOptionalResendClient(): ReturnType<typeof getResendClient> | null {
  try {
    return getResendClient();
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('Skipping Resend contact sync because Resend is not configured', err);
    }
    return null;
  }
}

async function resolveResendAudienceId(resend: ReturnType<typeof getResendClient>): Promise<string | null> {
  const configured = process.env.RESEND_AUDIENCE_ID?.trim();
  if (configured) return configured;
  if (cachedAudienceId !== undefined) return cachedAudienceId;

  try {
    const response = await resend.audiences.list();
    if (response.error) {
      console.warn('Unable to resolve Resend audience for contact sync', response.error);
      cachedAudienceId = null;
      return null;
    }
    const audiences = response.data?.data ?? [];
    const general = audiences.find((audience: { name?: string | null }) => audience.name?.trim().toLowerCase() === 'general');
    const selected = general ?? (audiences.length === 1 ? audiences[0] : null);
    cachedAudienceId = selected?.id ?? null;
    if (!cachedAudienceId && audiences.length > 1) {
      console.warn('Multiple Resend audiences found; set RESEND_AUDIENCE_ID to enable audience contact sync');
    }
    return cachedAudienceId;
  } catch (err) {
    console.warn('Unable to resolve Resend audience for contact sync', err);
    cachedAudienceId = null;
    return null;
  }
}

function splitContactName(name?: string | null): { firstName?: string; lastName?: string } {
  const normalized = name?.trim().replace(/\s+/g, ' ');
  if (!normalized) return {};
  const parts = normalized.split(' ');
  if (parts.length === 1) return { firstName: truncateContactField(parts[0]) };
  return {
    firstName: truncateContactField(parts[0]),
    lastName: truncateContactField(parts.slice(1).join(' ')),
  };
}

function truncateContactField(value: string) {
  return value.length > 120 ? value.slice(0, 120) : value;
}

function isDuplicateContactError(error: any) {
  const message = String(error?.message ?? '').toLowerCase();
  return error?.statusCode === 409 || message.includes('already exists') || message.includes('already exist') || message.includes('duplicate');
}

function isNotFoundContactError(error: any) {
  const message = String(error?.message ?? '').toLowerCase();
  return error?.statusCode === 404 || message.includes('not found') || message.includes('not exist');
}

function formatResendError(error: any) {
  const status = error?.statusCode ? `${error.statusCode} ` : '';
  const name = error?.name ? `${error.name}: ` : '';
  return `${status}${name}${error?.message ?? 'Unknown Resend error'}`;
}
