'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { AdminDailyNewUsersBarChart } from '@/components/admin/AdminDailyNewUsersBarChart';
import { AdminUserCardMobile } from '@/components/admin/AdminUserCardMobile';
import { formatDateTimeAdmin } from '@/lib/date';
import { useAdminUserSearch } from '@/components/admin/useAdminUserSearch';

type AdminDashboardSnapshotView = {
  counts: {
    users: number;
    projects: number;
    pendingApprovals: number;
    errors: number;
  };
  dailyNewUsersWindowDays: number;
  dailyNewUsers: Array<{ date: string; label: string; count: number }>;
  recentUsers: Array<{ id: string; email: string; name: string | null; createdAt: string }>;
};

type AdminDashboardUserMetricsSectionProps = {
  withoutGuests: AdminDashboardSnapshotView;
  withGuests: AdminDashboardSnapshotView;
  children: ReactNode;
};

export function AdminDashboardUserMetricsSection({
  withoutGuests,
  withGuests,
  children,
}: AdminDashboardUserMetricsSectionProps) {
  const [includeGuestUsers, setIncludeGuestUsers] = useState(false);
  const snapshot = useMemo(
    () => (includeGuestUsers ? withGuests : withoutGuests),
    [includeGuestUsers, withGuests, withoutGuests],
  );
  const userSearch = useAdminUserSearch({
    includeGuestUsers,
    includeDeleted: false,
    limit: 20,
  });
  const visibleUsers = userSearch.isActiveQuery ? userSearch.results : snapshot.recentUsers;
  const { counts } = snapshot;

  return (
    <>
      <div className="flex items-center justify-end">
        <label htmlFor="include-guest-users" className="flex cursor-pointer items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
          <Checkbox
            id="include-guest-users"
            checked={includeGuestUsers}
            onCheckedChange={(checked) => setIncludeGuestUsers(checked === true)}
          />
          <span>Include @guest.yumcut accounts</span>
        </label>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs dark:border-gray-800 dark:bg-gray-950">
              <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Total users</div>
              <div className="mt-1 text-2xl font-semibold leading-none">{counts.users.toLocaleString()}</div>
            </div>
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs dark:border-gray-800 dark:bg-gray-950">
              <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Projects</div>
              <div className="mt-1 text-2xl font-semibold leading-none">{counts.projects.toLocaleString()}</div>
            </div>
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
              <div className="text-[11px] uppercase tracking-wide">Needs approval</div>
              <div className="mt-1 text-2xl font-semibold leading-none">{counts.pendingApprovals.toLocaleString()}</div>
            </div>
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
              <div className="text-[11px] uppercase tracking-wide">Active errors</div>
              <div className="mt-1 text-2xl font-semibold leading-none">{counts.errors.toLocaleString()}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle>New users per day</CardTitle>
          <CardDescription>
            Last {snapshot.dailyNewUsersWindowDays} days, grouped by day.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminDailyNewUsersBarChart data={snapshot.dailyNewUsers} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between min-w-0">
            <CardTitle className="truncate">Recent users</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/users">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 overflow-hidden">
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
            <div className="sm:hidden max-h-[45vh] overflow-auto pr-3 space-y-2">
              {visibleUsers.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-300">
                  {userSearch.isActiveQuery ? 'No users found.' : 'No users yet.'}
                </p>
              ) : (
                visibleUsers.map((user) => (
                  <AdminUserCardMobile
                    key={user.id}
                    id={user.id}
                    name={user.name}
                    email={user.email}
                    createdAtLabel={formatDateTimeAdmin(user.createdAt)}
                  />
                ))
              )}
            </div>
            <div className="hidden sm:block">
              {visibleUsers.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-300">
                  {userSearch.isActiveQuery ? 'No users found.' : 'No users yet.'}
                </p>
              ) : (
                <div className="max-h-[45vh] w-full min-w-0 overflow-auto pr-1 space-y-3">
                  {visibleUsers.map((user) => (
                    <Link
                      key={user.id}
                      href={`/admin/users/${user.id}`}
                      className="block w-full min-w-0 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm transition hover:border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:hover:border-gray-700 dark:hover:bg-gray-900"
                    >
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <div className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-gray-100">{user.name || user.email}</div>
                        <div className="shrink-0 text-xs text-gray-500 dark:text-gray-400">{formatDateTimeAdmin(user.createdAt)}</div>
                      </div>
                      <div className="truncate text-xs text-gray-500 dark:text-gray-400 break-words">{user.email}</div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {children}
      </div>
    </>
  );
}
