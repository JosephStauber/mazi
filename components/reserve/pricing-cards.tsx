"use client";

import { PRICING } from "@/lib/reserve/config";

/** Mazi's single paid plan: free during testing + the referral promise. */
export function PricingCards() {
  const { plan } = PRICING;
  return (
    <div className="space-y-5">
      <div className="rounded-[var(--radius-md)] border border-accent bg-accent-muted px-4 py-3 text-center text-sm font-medium text-foreground">
        {PRICING.testingBanner}
      </div>

      <div className="rounded-[var(--radius-lg)] border border-border-strong bg-surface p-6 text-center shadow-sm">
        <div className="brand text-xl text-foreground">{plan.name}</div>
        <div className="mt-2 flex items-baseline justify-center gap-1">
          <span className="brand text-4xl text-foreground">{plan.price}</span>
          <span className="text-sm text-muted-foreground">{plan.cadence}</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{plan.blurb}</p>
        <ul className="mx-auto mt-4 inline-flex flex-col gap-1.5 text-left">
          {plan.features.map((f) => (
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

      <div className="rounded-[var(--radius-md)] border border-dashed border-border-strong px-4 py-3 text-center text-sm text-foreground">
        <span className="font-semibold text-accent">Bring friends. </span>
        {PRICING.referral}
      </div>
    </div>
  );
}
