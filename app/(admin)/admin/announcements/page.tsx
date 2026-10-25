import { OwnerOnly } from "@/components/admin/admin-role";
import { AnnouncementAdmin } from "@/components/admin/announcement-admin";

export default function AdminAnnouncementsPage() {
  return (
    <OwnerOnly>
      <AnnouncementAdmin />
    </OwnerOnly>
  );
}
