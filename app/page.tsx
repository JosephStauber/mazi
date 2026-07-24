import Link from "next/link";
import { isReservationMode } from "@/lib/reserve/config";

export default function LandingPage() {
  const reserving = isReservationMode();
  const primaryHref = reserving ? "/reserve" : "/signup";

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <span className="brand text-2xl">
            mazi<span className="brand-dot">.</span>
          </span>
          <div className="flex items-center gap-1.5">
            <Link
              href="/login"
              className="inline-flex h-9 items-center rounded-[var(--radius-md)] px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Log in
            </Link>
            <Link
              href={primaryHref}
              className="inline-flex h-9 items-center rounded-[var(--radius-md)] bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              {reserving ? "Reserve" : "Sign up"}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-5 py-24 text-center">
          <div className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            No algorithm · No ads · No tracking
          </div>

          <h1
            className="brand animate-fade-up mt-8 text-balance text-5xl leading-[1.02] sm:text-7xl"
            style={{ animationDelay: "60ms" }}
          >
            Social, without
            <br />
            the <span className="italic text-accent">noise.</span>
          </h1>

          <p
            className="animate-fade-up mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground"
            style={{ animationDelay: "120ms" }}
          >
            Mazi is a minimalist social platform built on privacy, chronological
            feeds, and small communities. You decide who you follow — and you see
            every post, in order.
          </p>

          <div
            className="animate-fade-up mt-10 flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center"
            style={{ animationDelay: "180ms" }}
          >
            <Link
              href={primaryHref}
              className="inline-flex h-12 w-full items-center justify-center rounded-[var(--radius-md)] bg-accent px-7 text-base font-semibold text-accent-foreground shadow-[var(--shadow-md)] transition-all duration-150 ease-spring hover:opacity-90 active:scale-[0.98] sm:w-auto"
            >
              {reserving ? "Reserve your username" : "Get started"}
            </Link>
            <Link
              href="/login"
              className="inline-flex h-12 w-full items-center justify-center rounded-[var(--radius-md)] border border-border-strong px-7 text-base font-medium text-foreground transition-colors hover:bg-muted sm:w-auto"
            >
              I have an account
            </Link>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto grid max-w-5xl gap-px overflow-hidden border-x border-border bg-border sm:grid-cols-3">
            <Feature
              title="Chronological"
              body="Your feed shows posts in order, newest first. No ranking, no manipulation, no surprises."
            />
            <Feature
              title="Privacy-first"
              body="No tracking, no profiling, no data selling. Your account is yours alone."
            />
            <Feature
              title="Small communities"
              body="Meaningful spaces over mass broadcasting. Quality of connection over reach."
            />
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-5 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <span>Mazi — Built with intention.</span>
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <Link href="/legal/privacy" className="transition-colors hover:text-foreground">
              Privacy
            </Link>
            <Link href="/legal/terms" className="transition-colors hover:text-foreground">
              Terms
            </Link>
            <Link href="/legal/guidelines" className="transition-colors hover:text-foreground">
              Guidelines
            </Link>
            <Link href="/legal/cookies" className="transition-colors hover:text-foreground">
              Cookies
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-background p-8">
      <h3 className="brand text-xl text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
