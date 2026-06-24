"use client";

import Link from 'next/link';
import { useState } from 'react';
import { AdminTransactionCard } from '@/components/admin/AdminTransactionCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AdminTransactionListItem } from '@/server/admin/transactions';

const COMPACT_TRANSACTION_COUNT = 4;

type AdminRecentTransactionsCardProps = {
  transactions: AdminTransactionListItem[];
};

export function AdminRecentTransactionsCard({ transactions }: AdminRecentTransactionsCardProps) {
  const [compact, setCompact] = useState(true);
  const canToggle = transactions.length > COMPACT_TRANSACTION_COUNT;
  const visibleTransactions = compact ? transactions.slice(0, COMPACT_TRANSACTION_COUNT) : transactions;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 min-w-0">
        <CardTitle className="truncate">Recent transactions</CardTitle>
        <div className="flex shrink-0 items-center gap-2">
          {canToggle ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="cursor-pointer"
              onClick={() => setCompact((value) => !value)}
            >
              {compact ? `Show ${transactions.length}` : 'Show 4'}
            </Button>
          ) : null}
          <Button asChild variant="outline" size="sm" className="cursor-pointer">
            <Link href="/admin/transactions">View all</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 overflow-hidden">
        {transactions.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-300">No token activity recorded.</p>
        ) : (
          <div className="w-full min-w-0 space-y-3">
            {visibleTransactions.map((transaction) => (
              <AdminTransactionCard key={transaction.id} transaction={transaction} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
