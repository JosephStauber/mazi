import { ProfileSettingsForm } from "@/components/settings/profile-settings-form";

export default function ProfileSettingsPage() {
  // The form reads the live profile from Convex; the layout guarantees a session.
  return <ProfileSettingsForm />;
}
