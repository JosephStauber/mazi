import type { Metadata } from "next";
import { getReservationStats, getReservationList } from "@/lib/queries/admin";
import { ReservationDashboard } from "@/components/admin/reservation-dashboard";

export const metadata: Metadata = { title: "Reservations — Admin" };

// Always fresh — this is live operational data.
export const dynamic = "force-dynamic";

export default async function AdminReservationsPage() {
  // The (admin) layout already gated on is_admin; the RPCs are guarded too.
  const [stats, rows] = await Promise.all([
    getReservationStats(),
    getReservationList(),
  ]);

  if (!stats) {
    return (
      <p className="text-muted-foreground">
        Couldn&rsquo;t load reservation stats. Make sure migration{" "}
        <code>00011</code> is applied and you&rsquo;re on the admin allowlist.
      </p>
    );
  }

  return (
    <ReservationDashboard
      stats={stats}
      rows={rows ?? []}
      listError={rows === null}
    />
  );
}
