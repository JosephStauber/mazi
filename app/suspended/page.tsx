import { redirect } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { fetchAuthQuery } from "@/lib/auth-server";
import { SuspendedNotice } from "@/components/auth/suspended-notice";

/**
 * Where a suspended account lands. It can read the statement of reasons,
 * download its data and sign out — nothing else (convex/lib/access.ts).
 */
export default async function SuspendedPage() {
  const profile = await fetchAuthQuery(api.profiles.me);
  if (!profile) redirect("/login");
  const suspension = await fetchAuthQuery(api.account.mySuspension);
  if (!suspension) redirect("/home");

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-5 py-10">
      <SuspendedNotice
        username={profile.username}
        reason={suspension.reason}
        since={suspension.since}
      />
    </div>
  );
}
