"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { buttonClassName } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ReferralShare } from "@/components/reserve/referral-share";

export default function WelcomePage() {
  const profile = useQuery(api.profiles.me);
  const reservation = useQuery(api.reservations.mine);

  if (!profile) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="animate-fade-up space-y-6">
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Reserved
        </span>
        <h1 className="brand mt-4 text-3xl text-foreground">
          You&rsquo;re in, @{profile.username}.
        </h1>
        <p className="mt-2 text-pretty text-muted-foreground">
          Mazi is still in private testing. We&rsquo;ll email you the moment your
          spot opens.
        </p>
      </div>

      {reservation && (
        <ReferralShare
          referralCode={reservation.referral_code}
          count={reservation.referral_count}
        />
      )}

      <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
        <p className="text-sm font-semibold text-foreground">Get a head start</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Set up your profile now so it&rsquo;s ready the day you get in.
        </p>
        <Link
          href="/welcome/profile"
          className={buttonClassName({
            variant: "outline",
            size: "md",
            className: "mt-3",
          })}
        >
          Customize your profile →
        </Link>
      </div>
    </div>
  );
}
