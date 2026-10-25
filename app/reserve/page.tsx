import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { fetchAuthQuery } from "@/lib/auth-server";
import { ReserveFlow } from "@/components/reserve/reserve-flow";
import { SITE_NAME } from "@/lib/site";

const title = "Reserve your username — Mazi";
const description =
  "Mazi is opening soon — a social platform with no algorithm, no ads, and no tracking. Reserve your username before it's taken.";

export const metadata: Metadata = {
  title,
  description,
  // Referral links (?ref=) all fold into the one canonical page.
  alternates: { canonical: "/reserve" },
  // Overriding openGraph here drops the root opengraph-image, so name it again.
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    url: "/reserve",
    title,
    description,
    images: "/opengraph-image",
  },
  twitter: { card: "summary_large_image", title, description, images: "/opengraph-image" },
};

export default async function ReservePage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  // Logged-in users don't belong in the funnel — send them where they go.
  const profile = await fetchAuthQuery(api.profiles.me);
  if (profile) {
    redirect(profile.access_level === "reserved" ? "/welcome" : "/home");
  }

  const { ref } = await searchParams;
  return <ReserveFlow referredBy={ref} />;
}
