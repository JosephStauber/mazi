/**
 * Single source of truth for the pre-launch onboarding funnel: survey options,
 * the time-reclaim model, placeholder pricing, and the launch-mode flag.
 * Copy/numbers here are meant to be tweaked without touching components.
 */

export type LaunchMode = "reservation" | "open";

/** Max rows the admin reservation-list RPC returns (mirror of the SQL limit). */
export const RESERVATION_LIST_LIMIT = 2000;

/**
 * `reservation` (default): the public face is the /reserve funnel; open signup
 * is closed. Flip `NEXT_PUBLIC_LAUNCH_MODE=open` at launch to restore /signup.
 */
export function launchMode(): LaunchMode {
  return process.env.NEXT_PUBLIC_LAUNCH_MODE === "open" ? "open" : "reservation";
}

export function isReservationMode(): boolean {
  return launchMode() === "reservation";
}

/** Canonical survey reason IDs — the single source of truth (mirrored in the
 * 00012 trigger's sanitization and the Zod schema). */
export const REASON_IDS = [
  "privacy",
  "data_selling",
  "ads",
  "addictive",
  "algorithm",
  "short_form",
  "outrage",
  "comparison",
] as const;

/** "What bothers you about social media today?" — multi-select. */
export const SURVEY_OPTIONS: { id: (typeof REASON_IDS)[number]; label: string; blurb: string }[] = [
  { id: "privacy", label: "Privacy", blurb: "Being tracked and profiled" },
  { id: "data_selling", label: "My data for sale", blurb: "Sold to advertisers" },
  { id: "ads", label: "Endless ads", blurb: "Feeds full of promotions" },
  { id: "addictive", label: "It's addictive", blurb: "Designed to hook you" },
  { id: "algorithm", label: "The algorithm", blurb: "Deciding what you see" },
  { id: "short_form", label: "Short-form spiral", blurb: "Doomscrolling for hours" },
  { id: "outrage", label: "Outrage & noise", blurb: "Engagement-bait and fighting" },
  { id: "comparison", label: "Comparison", blurb: "Everyone performing a highlight reel" },
];

/** Daily social-media time slider (minutes). */
export const TIME_SLIDER = {
  min: 15,
  max: 360,
  step: 5,
  default: 150, // ~2.5h/day, near reported averages
};

/**
 * Illustrative share of current social time reclaimed on Mazi (no algorithm,
 * chronological, no infinite feed). Tunable; copy avoids hard guarantees.
 */
export const RECLAIM_FACTOR = 0.6;

/** Reclaimed minutes per week / month / year for a given daily-minutes input. */
export function reclaimedMinutes(dailyMinutes: number): {
  week: number;
  month: number;
  year: number;
} {
  const perDay = dailyMinutes * RECLAIM_FACTOR;
  return {
    week: Math.round(perDay * 7),
    month: Math.round(perDay * 30),
    year: Math.round(perDay * 365),
  };
}

/** Pricing — Mazi is a paid app; free only during the testing period. */
export const PRICING = {
  testingBanner: "Free for everyone during the testing period.",
  plan: {
    name: "Mazi",
    price: "$4.99",
    cadence: "/month after launch",
    blurb: "The whole app — chronological, private, no ads.",
    features: [
      "Chronological feeds",
      "Small communities",
      "No ads, no tracking, ever",
    ],
  },
  /** Referral promise surfaced in the funnel + invite panel. */
  referral: "Invite a friend and earn a free week of Mazi — for every friend who joins.",
} as const;
