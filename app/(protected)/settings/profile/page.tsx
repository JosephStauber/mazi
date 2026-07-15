import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/queries/profiles";
import { ProfileSettingsForm } from "@/components/settings/profile-settings-form";

export default async function ProfileSettingsPage() {
  // Server-render the current profile (request-memoized) so the form has its
  // data on first paint instead of fetching it from the browser after mount.
  const profile = await getCurrentUser();
  if (!profile) redirect("/login");

  return <ProfileSettingsForm initialProfile={profile} />;
}
