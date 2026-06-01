import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center animate-fade-in">
      <span className="text-5xl font-bold tracking-tighter text-foreground">
        mazi
      </span>
      <h1 className="mt-6 text-xl font-semibold tracking-tight">
        This page doesn&apos;t exist
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        The page you&apos;re looking for can&apos;t be found.
      </p>
      <Link
        href="/home"
        className="mt-6 inline-flex h-10 items-center rounded-[var(--radius-md)] bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90"
      >
        Back home
      </Link>
    </div>
  );
}
