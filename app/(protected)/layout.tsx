import { redirect } from "next/navigation";
import { getAuthUser, getCurrentUser } from "@/lib/queries/profiles";
import { getUnreadCount } from "@/lib/queries/notifications";
import { DesktopNav } from "@/components/nav/desktop-nav";
import { MobileNav } from "@/components/nav/mobile-nav";
import { MobileHeader } from "@/components/nav/mobile-header";
import { PageTransition } from "@/components/nav/page-transition";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authUser = await getAuthUser();
  if (!authUser) redirect("/login");

  // Profile is request-memoized (getCurrentUser) so the wrapped page reuses it
  // without a second read; the unread count is independent, so start it in
  // parallel rather than after the profile resolves.
  const [profile, unreadCount] = await Promise.all([
    getCurrentUser(),
    getUnreadCount(authUser.id),
  ]);
  if (!profile) redirect("/login");

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
