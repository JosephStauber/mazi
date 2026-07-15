import { getAuthUser } from "@/lib/queries/profiles";
import { SettingsMenu } from "@/components/settings/settings-menu";

export default async function SettingsPage() {
  // Server-render the sign-in email so the menu doesn't do a browser auth round
  // trip to show it. The protected layout already guarantees a session.
  const authUser = await getAuthUser();

  return (
    <div className="mx-auto max-w-lg px-1">
      <SettingsMenu email={authUser?.email ?? null} />
    </div>
  );
}
