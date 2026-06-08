import { prisma } from '@/server/db';
import { extractProjectIdFromTokenMetadata } from '@/server/admin/token-usage';

type PaginationInput = {
  page?: number;
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function clampPageSize(pageSize?: number) {
  const base = typeof pageSize === 'number' && Number.isFinite(pageSize) ? Math.floor(pageSize) : DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(base, 1), MAX_PAGE_SIZE);
}

function normalizePage(page?: number) {
  const base = typeof page === 'number' && Number.isFinite(page) ? Math.floor(page) : 1;
  return Math.max(base, 1);
}

export type AdminTransactionListItem = {
  id: string;
  delta: number;
  balanceAfter: number;
  type: string;
  description: string | null;
  initiator: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  project: {
    id: string;
    title: string;
  } | null;
};

export async function listTransactions(pagination: PaginationInput = {}) {
  const take = clampPageSize(pagination.pageSize);
  const page = normalizePage(pagination.page);
  const skip = (page - 1) * take;

  const [rows, total] = await prisma.$transaction([
    prisma.tokenTransaction.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      select: {
        id: true,
        delta: true,
        balanceAfter: true,
        type: true,
        description: true,
        initiator: true,
        metadata: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    }),
    prisma.tokenTransaction.count(),
  ]);

  const projectIds = Array.from(
    new Set(
      rows
        .map((row) => extractProjectIdFromTokenMetadata(row.metadata))
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  );

  const projects = projectIds.length > 0
    ? await prisma.project.findMany({
      where: {
        id: { in: projectIds },
        deleted: false,
      },
      select: {
        id: true,
        title: true,
      },
    })
    : [];

  const projectById = new Map(projects.map((project) => [project.id, project]));

  const items: AdminTransactionListItem[] = rows.map((row) => {
    const projectId = extractProjectIdFromTokenMetadata(row.metadata);
    const project = projectId ? projectById.get(projectId) ?? null : null;
    return {
      id: row.id,
      delta: row.delta,
      balanceAfter: row.balanceAfter,
      type: row.type,
      description: row.description,
      initiator: row.initiator,
      createdAt: row.createdAt.toISOString(),
      user: {
        id: row.user.id,
        email: row.user.email,
        name: row.user.name,
      },
      project: project
        ? {
          id: project.id,
          title: project.title,
        }
        : null,
    };
  });

  return {
    items,
    page,
    pageSize: take,
    total,
    totalPages: Math.max(Math.ceil(total / take), 1),
  };
}
