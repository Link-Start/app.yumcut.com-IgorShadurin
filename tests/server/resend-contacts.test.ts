import { beforeEach, describe, expect, it, vi } from 'vitest';

const contactsCreate = vi.hoisted(() => vi.fn());
const contactsRemove = vi.hoisted(() => vi.fn());
const audiencesList = vi.hoisted(() => vi.fn());

vi.mock('@/server/emails/resend', () => ({
  getResendClient: () => ({
    contacts: {
      create: contactsCreate,
      remove: contactsRemove,
    },
    audiences: {
      list: audiencesList,
    },
  }),
}));

const {
  addUserToResendContacts,
  normalizeResendContactEmail,
  removeUserFromResendContacts,
} = await import('@/server/emails/resend-contacts');

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.RESEND_AUDIENCE_ID;
  contactsCreate.mockResolvedValue({ data: { id: 'contact-1' } });
  contactsRemove.mockResolvedValue({ data: { id: 'contact-1', deleted: true } });
  audiencesList.mockResolvedValue({
    data: {
      data: [{ id: 'aud-general', name: 'General' }],
    },
  });
});

describe('Resend contact sync', () => {
  it('normalizes real emails and rejects guest emails', () => {
    expect(normalizeResendContactEmail(' User@Example.COM ')).toBe('user@example.com');
    expect(normalizeResendContactEmail('guest-1@guest.yumcut')).toBeNull();
    expect(normalizeResendContactEmail('not-an-email')).toBeNull();
  });

  it('adds real users to the configured Resend audience', async () => {
    process.env.RESEND_AUDIENCE_ID = 'aud-configured';

    const result = await addUserToResendContacts({
      userId: 'user-1',
      email: 'USER@example.com',
      name: 'Jane Doe',
    });

    expect(result).toEqual({ status: 'created', email: 'user@example.com', audienceId: 'aud-configured' });
    expect(audiencesList).not.toHaveBeenCalled();
    expect(contactsCreate).toHaveBeenCalledWith({
      audienceId: 'aud-configured',
      email: 'user@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
    });
  });

  it('uses the single Resend audience when no audience id is configured', async () => {
    const result = await addUserToResendContacts({
      userId: 'user-2',
      email: 'user2@example.com',
      name: 'Solo',
    });

    expect(result).toEqual({ status: 'created', email: 'user2@example.com', audienceId: 'aud-general' });
    expect(audiencesList).toHaveBeenCalled();
    expect(contactsCreate).toHaveBeenCalledWith({
      audienceId: 'aud-general',
      email: 'user2@example.com',
      firstName: 'Solo',
    });
  });

  it('skips guests and deleted users', async () => {
    await expect(addUserToResendContacts({ email: 'guest-1@guest.yumcut' })).resolves.toEqual({
      status: 'skipped',
      reason: 'invalid_or_guest_email',
    });
    await expect(addUserToResendContacts({ email: 'real@example.com', deleted: true })).resolves.toEqual({
      status: 'skipped',
      reason: 'deleted_user',
    });
    await expect(addUserToResendContacts({ email: 'real@example.com', isGuest: true })).resolves.toEqual({
      status: 'skipped',
      reason: 'guest_user',
    });
    expect(contactsCreate).not.toHaveBeenCalled();
  });

  it('treats duplicate contacts as already synced', async () => {
    process.env.RESEND_AUDIENCE_ID = 'aud-configured';
    contactsCreate.mockResolvedValue({
      error: { statusCode: 409, name: 'validation_error', message: 'Contact already exists' },
    });

    await expect(addUserToResendContacts({ email: 'dupe@example.com' })).resolves.toEqual({
      status: 'existing',
      email: 'dupe@example.com',
      audienceId: 'aud-configured',
    });
  });

  it('removes contacts from the audience and global contacts', async () => {
    process.env.RESEND_AUDIENCE_ID = 'aud-configured';

    await expect(removeUserFromResendContacts({ email: 'User@example.com' })).resolves.toEqual({
      status: 'removed',
      email: 'user@example.com',
      audienceId: 'aud-configured',
    });

    expect(contactsRemove).toHaveBeenCalledWith({ audienceId: 'aud-configured', email: 'user@example.com' });
    expect(contactsRemove).toHaveBeenCalledWith({ email: 'user@example.com' });
  });
});
