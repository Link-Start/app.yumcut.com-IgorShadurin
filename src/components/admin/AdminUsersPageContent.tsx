'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatDateTimeAdmin } from '@/lib/date';
import { useAdminUserSearch } from '@/components/admin/useAdminUserSearch';

type AdminUsersPageContentProps = {
  users: {
    items: Array<{
      id: string;
      email: string;
      name: string | null;
      image: string | null;
      createdAt: string;
      tokenBalance: number;
      isAdmin: boolean;
    }>;
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

function pageHref(page: number) {
  return page <= 1 ? '/admin/users' : `/admin/users?page=${page}`;
}

export function AdminUsersPageContent({ users }: AdminUsersPageContentProps) {
  const userSearch = useAdminUserSearch({
    includeGuestUsers: true,
    includeDeleted: true,
    limit: 50,
  });
  const visibleUsers = userSearch.isActiveQuery ? userSearch.results : users.items;
  const showPagination = !userSearch.isActiveQuery && users.totalPages > 1;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>All users</CardTitle>
          <div className="text-sm text-gray-500 dark:text-gray-300">
            {userSearch.isActiveQuery
              ? `${visibleUsers.length.toLocaleString()} matches`
              : `Page ${users.page} of ${users.totalPages} • ${users.total.toLocaleString()} total`}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={userSearch.query}
            onChange={(event) => userSearch.setQuery(event.target.value)}
            placeholder="Search by email or name"
            autoComplete="off"
            spellCheck={false}
            aria-label="Search users"
          />
          {userSearch.isTooShort ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Type at least {userSearch.minChars} characters to search.
            </p>
          ) : null}
          {userSearch.error ? (
            <p className="text-xs text-rose-600 dark:text-rose-300">{userSearch.error}</p>
          ) : null}
          {userSearch.isActiveQuery && userSearch.isLoading ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">Searching users...</p>
          ) : null}
          {visibleUsers.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-300">No users found.</p>
          ) : (
            visibleUsers.map((user) => (
              <Link
                key={user.id}
                href={`/admin/users/${user.id}`}
                className="flex flex-col gap-2 rounded-lg border border-gray-200 px-4 py-3 transition hover:border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:hover:border-gray-700 dark:hover:bg-gray-900"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{user.name || user.email}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-gray-500 dark:text-gray-400">{formatDateTimeAdmin(user.createdAt)}</div>
                    {user.isAdmin ? <Badge variant="danger">Admin</Badge> : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span>ID: {user.id}</span>
                  <span>Tokens: <span className="font-semibold text-gray-900 dark:text-gray-100">{user.tokenBalance.toLocaleString()}</span></span>
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      {showPagination ? (
        <div className="flex items-center justify-between">
          <Button asChild variant="outline" size="sm" disabled={users.page <= 1}>
            <Link href={pageHref(users.page - 1)}>Previous</Link>
          </Button>
          <Button asChild variant="outline" size="sm" disabled={users.page >= users.totalPages}>
            <Link href={pageHref(users.page + 1)}>Next</Link>
          </Button>
        </div>
      ) : null}
    </>
  );
}
