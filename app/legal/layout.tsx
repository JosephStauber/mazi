import Link from "next/link";
import { legal } from "@/lib/legal/config";

const docs = [
  { href: "/legal/privacy", label: "Privacy Policy" },
  { href: "/legal/terms", label: "Terms of Service" },
  { href: "/legal/guidelines", label: "Community Guidelines" },
  { href: "/legal/cookies", label: "Cookie Notice" },
];

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
          <Link href="/" className="brand text-2xl text-foreground">
            mazi<span className="brand-dot">.</span>
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Back to site
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12 sm:py-16">{children}</main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-3xl px-5 py-10">
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {docs.map((d) => (
              <Link
                key={d.href}
                href={d.href}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {d.label}
              </Link>
            ))}
          </nav>
          <p className="mt-6 text-xs text-subtle">
            © {new Date().getFullYear()} {legal.operator}. {legal.appName} is a
            privacy-first social platform.
          </p>
        </div>
      </footer>
    </div>
  );
}
