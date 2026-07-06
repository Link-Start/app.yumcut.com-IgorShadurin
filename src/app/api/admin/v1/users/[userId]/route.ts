import { NextRequest } from 'next/server';
import { prisma } from '@/server/db';
import { withApiError } from '@/server/errors';
import { notFound, ok } from '@/server/http';
import { requireAdminApiKey } from '@/server/admin/api-auth';
import {
  isoDate,
  noStoreInit,
  pickFields,
  resolveFieldSelection,
} from '@/server/admin/read-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { userId: string };

const USER_DETAIL_FIELDS = [
  'id',
  'email',
  'name',
  'image',
  'createdAt',
  'preferredLanguage',
  'tokenBalance',
  'isAdmin',
  'isGuest',
  'deleted',
  'deletedAt',
  'emailReplyBonusGrantedAt',
  'emailReplyBonusSourceId',
  'subscriptionWinbackBonusPending',
  'subscriptionWinbackBonusGrantedAt',
  'settings',
  'telegramAccount',
  'attribution',
  'counts',
  'recentProjects',
  'recentTokenTransactions',
  'subscriptionPurchases',
] as const;

const DEFAULT_USER_DETAIL_FIELDS = [
  'id',
  'email',
  'name',
  'createdAt',
  'preferredLanguage',
  'tokenBalance',
  'isAdmin',
  'deleted',
  'counts',
] as const satisfies readonly (typeof USER_DETAIL_FIELDS[number])[];

type UserDetailField = typeof USER_DETAIL_FIELDS[number];

function serializeProject(row: any) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    createdAt: isoDate(row.createdAt),
    updatedAt: isoDate(row.updatedAt),
    finalVideoUrl: row.finalVideoUrl ?? null,
  };
}

function serializeTransaction(row: any) {
  return {
    id: row.id,
    delta: row.delta,
    balanceAfter: row.balanceAfter,
    type: row.type,
    description: row.description ?? null,
    initiator: row.initiator ?? null,
    metadata: row.metadata ?? null,
    createdAt: isoDate(row.createdAt),
  };
}

function serializeSubscriptionPurchase(row: any) {
  return {
    id: row.id,
    productId: row.productId,
    originalTransactionId: row.originalTransactionId,
    transactionId: row.transactionId,
    environment: row.environment,
    purchaseDate: isoDate(row.purchaseDate),
    expiresDate: isoDate(row.expiresDate),
    payload: row.payload ?? null,
    createdAt: isoDate(row.createdAt),
    updatedAt: isoDate(row.updatedAt),
  };
}

function serializeUser(row: any, fields: readonly UserDetailField[]) {
  return pickFields(fields, {
    id: row.id,
    email: row.email,
    name: row.name ?? null,
    image: row.image ?? null,
    createdAt: isoDate(row.createdAt),
    preferredLanguage: row.preferredLanguage,
    tokenBalance: row.tokenBalance,
    isAdmin: row.isAdmin,
    isGuest: row.isGuest,
    deleted: row.deleted,
    deletedAt: isoDate(row.deletedAt),
    emailReplyBonusGrantedAt: isoDate(row.emailReplyBonusGrantedAt),
    emailReplyBonusSourceId: row.emailReplyBonusSourceId ?? null,
    subscriptionWinbackBonusPending: row.subscriptionWinbackBonusPending,
    subscriptionWinbackBonusGrantedAt: isoDate(row.subscriptionWinbackBonusGrantedAt),
    settings: row.settings ?? null,
    telegramAccount: row.telegramAccount
      ? {
          telegramId: row.telegramAccount.telegramId,
          chatId: row.telegramAccount.chatId,
          username: row.telegramAccount.username ?? null,
          firstName: row.telegramAccount.firstName ?? null,
          lastName: row.telegramAccount.lastName ?? null,
          linkedAt: isoDate(row.telegramAccount.linkedAt),
        }
      : null,
    attribution: row.attribution ?? null,
    counts: {
      projects: row._count?.projects ?? 0,
      tokenTransactions: row._count?.tokenTransactions ?? 0,
      inboundFeedbacks: row._count?.inboundFeedbacks ?? 0,
    },
    recentProjects: (row.projects ?? []).map(serializeProject),
    recentTokenTransactions: (row.tokenTransactions ?? []).map(serializeTransaction),
    subscriptionPurchases: (row.subscriptionPurchases ?? []).map(serializeSubscriptionPurchase),
  });
}

export const GET = withApiError(async function GET(req: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireAdminApiKey(req, 'read');
  if (!auth.context) return auth.error;

  const selection = resolveFieldSelection(req.nextUrl.searchParams, USER_DETAIL_FIELDS, DEFAULT_USER_DETAIL_FIELDS);
  if (!selection.fields) return selection.error;

  const { userId } = await params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      createdAt: true,
      preferredLanguage: true,
      tokenBalance: true,
      isAdmin: true,
      isGuest: true,
      deleted: true,
      deletedAt: true,
      emailReplyBonusGrantedAt: true,
      emailReplyBonusSourceId: true,
      subscriptionWinbackBonusPending: true,
      subscriptionWinbackBonusGrantedAt: true,
      settings: true,
      telegramAccount: true,
      attribution: true,
      projects: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          finalVideoUrl: true,
        },
      },
      tokenTransactions: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
      subscriptionPurchases: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
      _count: {
        select: {
          projects: true,
          tokenTransactions: true,
          inboundFeedbacks: true,
        },
      },
    },
  });

  if (!user) return notFound('User not found');
  return ok(serializeUser(user, selection.fields), noStoreInit());
}, 'Failed to load admin API user');
