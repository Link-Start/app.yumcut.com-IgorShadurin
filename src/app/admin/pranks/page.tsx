import { AdminBackButton } from '@/components/admin/AdminBackButton';
import { AdminImagePranksManager } from '@/components/admin/AdminImagePranksManager';

type AdminPranksPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function normalizeInitialTab(value: string | string[] | undefined) {
  const tab = Array.isArray(value) ? value[0] : value;
  return ['pranks', 'categories', 'subcategories', 'paywall'].includes(tab || '') ? tab : 'pranks';
}

export default async function AdminPranksPage(props: AdminPranksPageProps) {
  const searchParams = await props.searchParams;
  return (
    <div className="space-y-4">
      <AdminBackButton className="w-fit" />
      <AdminImagePranksManager initialTab={normalizeInitialTab(searchParams.tab)} />
    </div>
  );
}
