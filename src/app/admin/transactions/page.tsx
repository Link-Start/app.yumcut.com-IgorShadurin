import Link from 'next/link';
import { listTransactions } from '@/server/admin/transactions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminBackButton } from '@/components/admin/AdminBackButton';
import { AdminTransactionCard } from '@/components/admin/AdminTransactionCard';
import { Button } from '@/components/ui/button';

function parsePage(value: string | string[] | undefined) {
  if (!value) return 1;
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(String(raw), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function pageHref(page: number) {
  return page <= 1 ? '/admin/transactions' : `/admin/transactions?page=${page}`;
}

export default async function AdminTransactionsPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const resolved = await props.searchParams;
  const page = parsePage(resolved?.page);
  const pageSize = 20;
  const transactions = await listTransactions({ page, pageSize });

  return (
    <div className="space-y-6">
      <AdminBackButton className="w-fit" />

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
        <p className="text-sm text-gray-500 dark:text-gray-300">All token movements across users with current balance and transaction reason.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>All transactions</CardTitle>
          <div className="text-sm text-gray-500 dark:text-gray-300">
            Page {transactions.page} of {transactions.totalPages} • {transactions.total.toLocaleString()} total
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {transactions.items.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-300">No token activity recorded.</p>
          ) : (
            transactions.items.map((transaction) => (
              <AdminTransactionCard key={transaction.id} transaction={transaction} />
            ))
          )}
        </CardContent>
      </Card>

      {transactions.totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <Button asChild variant="outline" size="sm" disabled={transactions.page <= 1}>
            <Link href={pageHref(transactions.page - 1)}>Previous</Link>
          </Button>
          <Button asChild variant="outline" size="sm" disabled={transactions.page >= transactions.totalPages}>
            <Link href={pageHref(transactions.page + 1)}>Next</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
