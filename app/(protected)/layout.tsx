import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUnreadCount } from "@/lib/queries/notifications";
import { DesktopNav } from "@/components/nav/desktop-nav";
import { MobileNav } from "@/components/nav/mobile-nav";
import { MobileHeader } from "@/components/nav/mobile-header";
import { PageTransition } from "@/components/nav/page-transition";
import type { Profile } from "@/lib/types/database";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) redirect("/login");

  const { data: dbProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authUser.id)
    .single();

  const profile: Profile =
    dbProfile ?? {
      id: authUser.id,
      username:
        authUser.user_metadata?.username ??
        authUser.email?.split("@")[0] ??
        "user",
      bio: null,
      avatar_url: null,
      created_at: new Date().toISOString(),
    };

  const unreadCount = dbProfile ? await getUnreadCount(profile.id) : 0;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full">
        <DesktopNav user={profile} unreadCount={unreadCount} />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileHeader unreadCount={unreadCount} />
          <main className="mx-auto w-full max-w-[600px] flex-1 px-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-2 sm:px-5 md:border-x md:border-border md:pb-12 md:pt-0">
            <PageTransition>{children}</PageTransition>
          </main>
        </div>
      </div>
      <MobileNav username={profile.username} avatarUrl={profile.avatar_url} />
    </div>
  );
}
