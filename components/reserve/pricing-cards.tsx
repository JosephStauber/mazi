"use client";

import { cn } from "@/lib/utils/cn";
import { PRICING } from "@/lib/reserve/config";

/** Placeholder pricing preview: free-during-testing + referral promise. */
export function PricingCards() {
  return (
    <div className="space-y-5">
      <div className="rounded-[var(--radius-md)] border border-accent bg-accent-muted px-4 py-3 text-center text-sm font-medium text-foreground">
        {PRICING.testingBanner}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {PRICING.tiers.map((tier) => (
          <div
            key={tier.name}
            className={cn(
              "relative rounded-[var(--radius-lg)] border p-5",
              tier.highlight
                ? "border-border-strong bg-surface shadow-sm"
                : "border-border bg-surface"
            )}
          >
            {tier.placeholder && (
              <span className="absolute right-3 top-3 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Planned
              </span>
            )}
            <div className="brand text-lg text-foreground">{tier.name}</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-bold text-foreground">
                {tier.price}
              </span>
              <span className="text-xs text-muted-foreground">{tier.cadence}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{tier.blurb}</p>
            <ul className="mt-3 space-y-1.5">
              {tier.features.map((f) => (
                <li
                  key={f}
                  className="flex items-center gap-2 text-sm text-foreground"
                >
                  <span className="text-accent">·</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="rounded-[var(--radius-md)] border border-dashed border-border-strong px-4 py-3 text-center text-sm text-foreground">
        <span className="font-semibold text-accent">Bring friends. </span>
        {PRICING.referral}
      </div>
    </div>
  );
}
