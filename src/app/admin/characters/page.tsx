import { AdminBackButton } from '@/components/admin/AdminBackButton';
import { AdminCharactersManager } from '@/components/admin/AdminCharactersManager';

export default function AdminCharactersPage() {
  return (
    <div className="space-y-4">
      <AdminBackButton className="w-fit" />
      <AdminCharactersManager />
    </div>
  );
}
