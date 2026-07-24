import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/queries/profiles";
import { ProfileSettingsForm } from "@/components/settings/profile-settings-form";

/** Reserved accounts can customise their profile before launch. */
export default async function ReservedProfilePage() {
  const profile = await getCurrentUser();
  if (!profile) redirect("/login");

  return <ProfileSettingsForm initialProfile={profile} />;
}
