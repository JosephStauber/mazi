import { OwnerOnly } from "@/components/admin/admin-role";
import { HandlesAdmin } from "@/components/admin/handles-admin";

export default function AdminHandlesPage() {
  return (
    <OwnerOnly>
      <HandlesAdmin />
    </OwnerOnly>
  );
}
