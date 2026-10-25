/**
 * Public identity of the site, for search engines and link previews.
 *
 * SITE_URL is the canonical origin: every canonical link, sitemap entry, and
 * Open Graph URL resolves against it. It's fixed (not env-driven) so preview
 * and local builds never advertise themselves as the real site. The apex
 * domain redirects here, so keep it in step with the Vercel domain settings.
 */
export const SITE_URL = "https://www.mazi.social";

export const SITE_NAME = "Mazi";

export const SITE_TITLE = "Mazi — Privacy-first social network";

export const SITE_DESCRIPTION =
  "Mazi is a minimalist, privacy-first social network. Chronological feeds, small communities, no algorithm, no ads, no tracking.";

/** Pages anyone can read without an account — the only ones worth indexing. */
export const LEGAL_PATHS = [
  "/legal/privacy",
  "/legal/terms",
  "/legal/guidelines",
  "/legal/cookies",
] as const;
