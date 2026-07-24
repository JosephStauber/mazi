import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/queries/profiles";
import { ReservedHeader } from "@/components/reserve/reserved-header";

/**
 * The limited pre-launch area for `reserved` accounts. Full-access users don't
 * belong here (they get the real app), so they're bounced to /home.
 */
export default async function ReservedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentUser();
  if (!profile) redirect("/login");
  if (profile.access_level === "full") redirect("/home");

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <ReservedHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-6">{children}</main>
    </div>
  );
}
