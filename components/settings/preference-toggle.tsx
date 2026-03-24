"use client";

import { useEffect, useState } from "react";

interface PreferenceToggleProps {
  storageKey: string;
  label: string;
  description?: string;
  defaultOn?: boolean;
}

export function PreferenceToggle({
  storageKey,
  label,
  description,
  defaultOn = true,
}: PreferenceToggleProps) {
  const [on, setOn] = useState(defaultOn);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(storageKey);
      if (v !== null) setOn(v === "1");
      else setOn(defaultOn);
    } catch {
      setOn(defaultOn);
    }
    setReady(true);
  }, [storageKey, defaultOn]);

  function toggle() {
    const next = !on;
    setOn(next);
    try {
      localStorage.setItem(storageKey, next ? "1" : "0");
    } catch {
      /* private mode */
    }
  }

  if (!ready) {
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
