import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUnreadCount } from "@/lib/queries/notifications";
import { DesktopNav } from "@/components/nav/desktop-nav";
import { MobileNav } from "@/components/nav/mobile-nav";
import { MobileHeader } from "@/components/nav/mobile-header";
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authUser.id)
    .single();

  if (!profile) {
    const fallback: Profile = {
      id: authUser.id,
      username:
        authUser.user_metadata?.username ??
        authUser.email?.split("@")[0] ??
        "user",
      email: authUser.email ?? null,
      bio: null,
      avatar_url: null,
      created_at: new Date().toISOString(),
    };

    return (
      <div className="min-h-dvh bg-background text-foreground">
        <div className="mx-auto flex min-h-dvh w-full max-w-[100vw] md:max-w-none">
          <DesktopNav user={fallback} unreadCount={0} />
          <div className="flex min-w-0 flex-1 flex-col">
            <MobileHeader unreadCount={0} />
            <main className="mx-auto w-full max-w-[630px] flex-1 px-3 pb-[calc(4rem+env(safe-area-inset-bottom))] pt-4 md:border-x md:border-border md:px-6 md:pb-8 md:pt-8">
              {children}
            </main>
          </div>
        </div>
        <MobileNav
          username={fallback.username}
          avatarUrl={fallback.avatar_url}
        />
      </div>
    );
  }

  const unreadCount = await getUnreadCount(profile.id);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-[100vw] md:max-w-none">
        <DesktopNav user={profile} unreadCount={unreadCount} />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileHeader unreadCount={unreadCount} />
          <main className="mx-auto w-full max-w-[630px] flex-1 px-3 pb-[calc(4rem+env(safe-area-inset-bottom))] pt-4 md:border-x md:border-border md:px-6 md:pb-8 md:pt-8">
            {children}
          </main>
        </div>
      </div>
      <MobileNav
        username={profile.username}
        avatarUrl={profile.avatar_url}
      />
    </div>
  );
}
