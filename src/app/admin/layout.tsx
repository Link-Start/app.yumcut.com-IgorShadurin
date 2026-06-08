import { ReactNode } from 'react';
import { requireAdminOrRedirect } from '@/server/admin';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdminOrRedirect();
  return (
    <div className="mx-auto flex w-full max-w-[calc(100vw-2rem)] flex-col gap-8 py-2 xl:max-w-[calc(100vw-3rem)]">
      {children}
    </div>
  );
}
