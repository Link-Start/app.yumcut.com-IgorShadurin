import { AdminBackButton } from '@/components/admin/AdminBackButton';
import { AdminImagePranksManager } from '@/components/admin/AdminImagePranksManager';

export default function AdminPranksPage() {
  return (
    <div className="space-y-4">
      <AdminBackButton className="w-fit" />
      <AdminImagePranksManager />
    </div>
  );
}
