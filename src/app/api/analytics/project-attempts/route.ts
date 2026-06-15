import { NextRequest } from 'next/server';
import { prisma } from '@/server/db';
import { withApiError } from '@/server/errors';
import { ok, unauthorized } from '@/server/http';
import { authenticateApiRequest } from '@/server/api-user';
import { recordProjectCreationAttempt } from '@/server/analytics/project-attempts';
import { notifyAdminsOfProjectAttemptPaywall } from '@/server/telegram';

export const POST = withApiError(async function POST(req: NextRequest) {
  const auth = await authenticateApiRequest(req);
  if (!auth) return unauthorized();

  const payload = await req.json().catch(() => ({}));
  const { attempt, normalized, wasCreated } = await recordProjectCreationAttempt({
    userId: auth.userId,
    payload,
  });

  if (wasCreated && normalized.result === 'paywall_shown') {
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { email: true, name: true },
    });
    notifyAdminsOfProjectAttemptPaywall({
      attemptId: attempt.id,
      userId: auth.userId,
      userEmail: user?.email ?? auth.sessionUser?.email ?? null,
      userName: user?.name ?? auth.sessionUser?.name ?? null,
      promptText: normalized.promptText,
      promptMode: normalized.promptMode,
      projectExperience: normalized.projectExperience,
      durationSeconds: normalized.durationSeconds,
      tokenCost: normalized.tokenCost,
      tokenBalance: normalized.tokenBalance,
      mainPageMode: normalized.mainPageMode,
      mainPageCategoryId: normalized.mainPageCategoryId,
      characterSlug: normalized.characterSlug,
      templateId: normalized.templateId,
      utmSource: normalized.utmSource,
      utmMedium: normalized.utmMedium,
      utmCampaign: normalized.utmCampaign,
      intent: normalized.intent,
      sourceToolSlug: normalized.sourceToolSlug,
      referrerOrigin: normalized.referrerOrigin,
      referrerPath: normalized.referrerPath,
      landingPath: normalized.landingPath,
    }).catch((err) => {
      console.error('Failed to notify admins about paywall project attempt', err);
    });
  }

  return ok({
    id: attempt.id,
    clientAttemptId: attempt.clientAttemptId,
    result: attempt.result,
  });
}, 'Failed to record project creation attempt');
