import { prisma } from '@/server/db';
import { normalizeEmail } from '@/server/emails/planned';

export type PersistInboundFeedbackInput = {
  emailId: string;
  from: string;
  to: string[];
  subject: string;
  latestReplyText: string;
  snippetSource: 'api' | 'raw' | 'none';
  userId?: string | null;
  replyBonus: unknown;
  inboundFetchError?: string | null;
  telegramForwardError?: string | null;
  enriched: boolean;
  forwardedToTelegram: boolean;
};

function truncate(value: string | null | undefined, max: number) {
  const normalized = value?.trim() ?? '';
  return normalized ? normalized.slice(0, max) : null;
}

export async function persistInboundFeedback(input: PersistInboundFeedbackInput) {
  const emailId = truncate(input.emailId, 191);
  if (!emailId) return null;

  return (prisma as any).inboundFeedback.upsert({
    where: { emailId },
    create: {
      emailId,
      fromEmail: normalizeEmail(input.from),
      fromRaw: truncate(input.from, 512),
      toRecipients: input.to,
      subject: truncate(input.subject, 512),
      latestReplyText: input.latestReplyText || null,
      snippetSource: input.snippetSource,
      userId: input.userId ?? null,
      replyBonus: input.replyBonus ?? null,
      inboundFetchError: input.inboundFetchError ?? null,
      telegramForwardError: input.telegramForwardError ?? null,
      enriched: input.enriched,
      forwardedToTelegram: input.forwardedToTelegram,
    },
    update: {
      fromEmail: normalizeEmail(input.from),
      fromRaw: truncate(input.from, 512),
      toRecipients: input.to,
      subject: truncate(input.subject, 512),
      latestReplyText: input.latestReplyText || null,
      snippetSource: input.snippetSource,
      userId: input.userId ?? null,
      replyBonus: input.replyBonus ?? null,
      inboundFetchError: input.inboundFetchError ?? null,
      telegramForwardError: input.telegramForwardError ?? null,
      enriched: input.enriched,
      forwardedToTelegram: input.forwardedToTelegram,
    },
  });
}
