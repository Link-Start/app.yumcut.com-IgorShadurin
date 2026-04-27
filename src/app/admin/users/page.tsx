import { listUsers } from '@/server/admin/users';
import { AdminBackButton } from '@/components/admin/AdminBackButton';
import { AdminUsersPageContent } from '@/components/admin/AdminUsersPageContent';

function parsePage(value: string | string[] | undefined) {
  if (!value) return 1;
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(String(raw), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function AdminUsersPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const resolved = await props.searchParams;
  const page = parsePage(resolved?.page);
  const pageSize = 20;
  const users = await listUsers({ page, pageSize });

  return (
    <div className="space-y-6">
      <AdminBackButton className="w-fit" />

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-gray-500 dark:text-gray-300">Newest accounts first. Click into a profile to inspect balances, projects, and ledger history.</p>
      </div>

      <AdminUsersPageContent users={users} />
    </div>
  );
}
