import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { fetchAuthQuery } from "@/lib/auth-server";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminRoleProvider } from "@/components/admin/admin-role";

/**
 * Admin-only area. Auth is required, and the admin allowlist is the gate — a
 * non-admin gets a 404, so the area's existence isn't advertised. The role
 * only shapes the UI; every Convex function re-checks it (requireAdmin /
 * requireOwner).
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await fetchAuthQuery(api.profiles.me);
  if (!profile) redirect("/login");
  const role = await fetchAuthQuery(api.admin.myRole);
  if (!role) notFound();

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <Link href="/home" className="brand text-xl">
            mazi<span className="brand-dot">.</span>
            <span className="ml-2 align-middle text-xs font-normal not-italic text-muted-foreground">
              admin
            </span>
          </Link>
          <Link
            href="/home"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back to app
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-5 py-8">
        <AdminRoleProvider role={role}>
          <AdminNav />
          {children}
        </AdminRoleProvider>
      </main>
    </div>
  );
}
