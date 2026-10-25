import { redirect } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { fetchAuthQuery } from "@/lib/auth-server";
import { AppShell } from "@/components/nav/app-shell";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await fetchAuthQuery(api.profiles.me);
  if (!profile) redirect("/login");
  // Reserved (pre-launch) accounts can't use the app yet — hold them in the
  // limited welcome area. The Convex functions are the real enforcement
  // (requireFullAccess); this is the UX layer.
  if (profile.access_level === "reserved") redirect("/welcome");

  return <AppShell initialViewer={profile}>{children}</AppShell>;
}
