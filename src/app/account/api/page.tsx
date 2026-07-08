import { redirect } from 'next/navigation';
import { UserApiKeysCard } from '@/components/account/user-api-keys-card';
import { getAuthSession } from '@/server/auth';
import { listUserApiKeys } from '@/server/user-api/api-keys';

type SessionUser = {
  id?: string;
};

export const dynamic = 'force-dynamic';

export default async function AccountApiPage() {
  const session = await getAuthSession();
  const userSession = session?.user as SessionUser | undefined;
  if (!userSession?.id) {
    redirect('/');
  }

  const apiKeys = await listUserApiKeys(userSession.id);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <UserApiKeysCard initialKeys={apiKeys} />
    </div>
  );
}
