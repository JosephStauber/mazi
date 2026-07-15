"use client";

import { useState, useSyncExternalStore } from "react";

interface PreferenceToggleProps {
  storageKey: string;
  label: string;
  description?: string;
  defaultOn?: boolean;
}

// Reading localStorage is the external source; useSyncExternalStore keeps the
// initial value out of an effect (avoids react-hooks/set-state-in-effect) and
// safe across SSR hydration.
const noopSubscribe = () => () => {};

export function PreferenceToggle({
  storageKey,
  label,
  description,
  defaultOn = true,
}: PreferenceToggleProps) {
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
  const stored = useSyncExternalStore(
    noopSubscribe,
    () => {
      try {
        return localStorage.getItem(storageKey);
      } catch {
        return null;
      }
    },
    () => null
  );
  const [override, setOverride] = useState<boolean | null>(null);
  const on = override ?? (stored === null ? defaultOn : stored === "1");

  function toggle() {
    const next = !on;
    setOverride(next);
    try {
      localStorage.setItem(storageKey, next ? "1" : "0");
    } catch {
      /* private mode */
    }
  }

  if (!mounted) {
    return (
      <div className="flex h-9 items-center justify-between gap-4 py-1">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-6 w-11 animate-pulse rounded-full bg-muted" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description ? (
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
            {description}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={toggle}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
          on ? "bg-foreground" : "bg-muted-foreground/30"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-background shadow transition-transform ${
            on ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
