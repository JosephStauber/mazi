"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ReservationDashboard } from "@/components/admin/reservation-dashboard";
import { Spinner } from "@/components/ui/spinner";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";

export default function AdminReservationsPage() {
  // Live — new reservations appear as they come in. The (admin) layout gated
  // on the allowlist; these queries are admin-guarded too.
  const stats = useQuery(api.admin.reservationStats);
  const { items, firstLoad, loading, done, sentinelRef } = usePaginatedList(
    api.admin.reservationList,
    {},
    100
  );

  if (stats === undefined || firstLoad) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">
        <Spinner />
      </div>
    );
  }

  return (
    <ReservationDashboard
      stats={stats}
      rows={items}
      done={done}
      loading={loading}
      onSentinel={sentinelRef}
    />
  );
}
