import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { fetchAuthQuery } from "@/lib/auth-server";

/**
 * Admin-only area (reservation dashboard). Auth is required, and the admin
 * allowlist is the gate — a non-admin gets a 404, so the area's existence
 * isn't advertised. The Convex queries it calls are independently admin-guarded.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await fetchAuthQuery(api.profiles.me);
  if (!profile) redirect("/login");
  if (!(await fetchAuthQuery(api.admin.amIAdmin))) notFound();

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
      <main className="mx-auto w-full max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
