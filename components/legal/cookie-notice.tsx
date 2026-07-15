"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";

const STORAGE_KEY = "mazi_cookie_ack";

// The acknowledgement flag lives in localStorage; reading it via
// useSyncExternalStore keeps it out of an effect (avoids
// react-hooks/set-state-in-effect) and defaults to hidden on the server.
const noopSubscribe = () => () => {};

/**
 * Non-blocking disclosure. We only set strictly-necessary cookies, so consent
 * isn't legally required — this simply informs the user, per ePrivacy
 * transparency expectations, and remembers the dismissal on their device.
 */
export function CookieNotice() {
  const acked = useSyncExternalStore(
    noopSubscribe,
    () => {
      try {
        return !!localStorage.getItem(STORAGE_KEY);
      } catch {
        return true;
      }
    },
    () => true
  );
  const [dismissed, setDismissed] = useState(false);
  const show = !acked && !dismissed;

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  if (!show) return null;

  return (
    <div className="animate-fade-up fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-md rounded-[var(--radius-lg)] border border-border-strong bg-surface p-4 shadow-[var(--shadow-lg)] sm:inset-x-auto sm:left-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        We use only essential cookies to keep you signed in — no tracking, no
        ads.{" "}
        <Link href="/legal/cookies" className="font-medium text-accent hover:opacity-70">
          Learn more
        </Link>
        .
      </p>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex h-9 items-center rounded-[var(--radius-md)] bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
