"use client";

import { useState } from "react";
import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { PRICING } from "@/lib/reserve/config";
import { useOrigin } from "@/lib/hooks/use-origin";

/** Post-reservation: confirmation + referral link (the "earn free weeks" loop). */
export function InvitePanel({
  username,
  referralCode,
  needsEmailConfirmation,
}: {
  username: string;
  referralCode: string | null;
  needsEmailConfirmation: boolean;
}) {
  const origin = useOrigin();
  const link = referralCode ? `${origin}/reserve?ref=${referralCode}` : "";
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
    <div className="space-y-6 text-center">
      <div className="animate-scale-in mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
          <path
            d="M5 13l4 4L19 7"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div>
        <h2 className="brand text-3xl text-foreground">
          {needsEmailConfirmation ? "Check your inbox" : `@${username} is reserved.`}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-pretty text-muted-foreground">
          {needsEmailConfirmation
            ? "We sent a link to confirm your email and activate your reservation. Your invite link is waiting inside once you're in."
            : "You're on the list. We'll email you the moment Mazi opens."}
        </p>
      </div>

      {referralCode && (
        <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5 text-left">
          <p className="text-sm font-semibold text-foreground">
            Skip the line — bring your people.
          </p>
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
      )}

      {!needsEmailConfirmation && (
        <Link
          href="/welcome"
          className={buttonClassName({ variant: "outline", size: "lg", fullWidth: true })}
        >
          Set up your profile →
        </Link>
      )}
    </div>
  );
}
