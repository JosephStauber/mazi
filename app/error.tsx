"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center animate-fade-in">
      <span className="text-5xl font-bold tracking-tighter text-foreground">
        mazi
      </span>
      <h1 className="mt-6 text-xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">
        An unexpected error occurred. Try again, and if it keeps happening, come
        back in a moment.
      </p>
      <Button onClick={reset} className="mt-6">
        Try again
      </Button>
    </div>
  );
}
