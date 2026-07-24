"use client";

import { useState } from "react";
import { buttonClassName } from "@/components/ui/button";
import { PRICING } from "@/lib/reserve/config";
import { useOrigin } from "@/lib/hooks/use-origin";

/** Referral link + live count (one free week earned per friend who joins). */
export function ReferralShare({
  referralCode,
  count,
}: {
  referralCode: string;
  count: number;
}) {
  const origin = useOrigin();
  const link = `${origin}/reserve?ref=${referralCode}`;
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — the field is selectable as a fallback */
    }
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">
          Invite friends, earn free weeks
        </p>
        <span className="shrink-0 rounded-full bg-accent-muted px-2.5 py-1 text-xs font-semibold text-accent">
          {count} joined · {count} {count === 1 ? "week" : "weeks"}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{PRICING.referral}</p>

      <div className="mt-3 flex gap-2">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="h-10 min-w-0 flex-1 rounded-[var(--radius-md)] border border-border bg-background px-3 text-sm text-foreground"
        />
        <button
          type="button"
          onClick={copy}
          className={buttonClassName({ variant: "default", size: "md" })}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}
