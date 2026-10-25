import { Suspense } from "react";
import { AuditLog } from "@/components/admin/audit-log";

export default function AdminAuditPage() {
  // AuditLog reads its filters from the URL (useSearchParams).
  return (
    <Suspense>
      <AuditLog />
    </Suspense>
  );
}
