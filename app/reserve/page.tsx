import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/queries/profiles";
import { ReserveFlow } from "@/components/reserve/reserve-flow";

export const metadata: Metadata = {
  title: "Reserve your username — Mazi",
  description:
    "Mazi is opening soon — a social platform with no algorithm, no ads, and no tracking. Reserve your username before it's taken.",
};

export default async function ReservePage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  // Logged-in users don't belong in the funnel — send them where they go.
  const profile = await getCurrentUser();
  if (profile) {
    redirect(profile.access_level === "reserved" ? "/welcome" : "/home");
  }

  const { ref } = await searchParams;
  return <ReserveFlow referredBy={ref} />;
}
