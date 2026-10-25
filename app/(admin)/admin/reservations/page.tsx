"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ReservationDashboard } from "@/components/admin/reservation-dashboard";
import { Spinner } from "@/components/ui/spinner";

export default function AdminReservationsPage() {
  // Live — new reservations appear as they come in. The (admin) layout gated
  // on the allowlist; these queries are admin-guarded too.
  const stats = useQuery(api.admin.reservationStats);
  const rows = useQuery(api.admin.reservationList);

  if (stats === undefined || rows === undefined) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">
        <Spinner />
      </div>
    );
  }

  return <ReservationDashboard stats={stats} rows={rows} listError={false} />;
}
