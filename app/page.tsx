import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <span className="text-lg font-bold tracking-tight">mazi</span>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-9 items-center rounded-md bg-foreground px-4 text-sm font-medium text-background hover:bg-foreground/90 transition-colors"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="max-w-xl text-center space-y-6">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Social, without the noise.
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Mazi is a minimalist social platform built on privacy, chronological
            feeds, and small communities. No algorithm decides what you see. No
            ads compete for your attention.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/signup"
              className="inline-flex h-12 w-full items-center justify-center rounded-md bg-foreground px-6 text-base font-medium text-background hover:bg-foreground/90 transition-colors sm:w-auto"
            >
              Get started
            </Link>
            <Link
              href="/login"
              className="inline-flex h-12 w-full items-center justify-center rounded-md border border-border px-6 text-base font-medium text-foreground hover:bg-muted transition-colors sm:w-auto"
            >
              I have an account
            </Link>
          </div>
        </div>

        <div className="mt-24 grid max-w-2xl gap-8 sm:grid-cols-3 text-center">
          <div>
            <h3 className="font-semibold">Chronological</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Your feed shows posts in order. No algorithm, no manipulation.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Privacy-first</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Your data is yours. We don&apos;t track, profile, or sell it.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Small communities</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Meaningful spaces over mass broadcasting. Quality over reach.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        Mazi — Built with intention.
      </footer>
    </div>
  );
}
