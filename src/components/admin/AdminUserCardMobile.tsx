"use client";
import Link from 'next/link';
import { UserX } from 'lucide-react';

type Props = {
  id: string;
  name?: string | null;
  email: string;
  createdAtLabel: string;
  deleted?: boolean;
};

export function AdminUserCardMobile({ id, name, email, createdAtLabel, deleted = false }: Props) {
  return (
    <Link
      href={`/admin/users/${id}`}
      className="block rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-colors hover:border-gray-300 dark:border-gray-800 dark:bg-gray-950 dark:hover:border-gray-700"
    >
      <div className="min-w-0 flex items-start gap-2">
        {deleted ? (
          <UserX className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" aria-label="Deleted user" />
        ) : null}
        <div className="min-w-0 text-sm font-medium text-gray-900 dark:text-gray-100 break-words">{name || email}</div>
      </div>
      <div className="mt-0.5 text-xs text-gray-500 break-words dark:text-gray-400">{email}</div>
      <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">Joined {createdAtLabel}</div>
    </Link>
  );
}
