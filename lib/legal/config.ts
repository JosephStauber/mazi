/**
 * Single source of truth for legal/policy pages.
 *
 * ⚠️  ACTION REQUIRED: replace every value marked "TODO" with your real
 * details before launching publicly. These strings render verbatim inside
 * the Privacy Policy, Terms of Service, and other legal documents, which are
 * legally binding. Have counsel review the final text.
 */
export const legal = {
  /** Product/brand name shown to users. */
  appName: "Mazi",

  /** Legal entity or individual that operates the service ("the data controller"). */
  operator: "TODO — Your legal entity or full name",

  /** Country/state whose law governs the Terms and acts as GDPR establishment. */
  governingLaw: "TODO — e.g. England & Wales, or Delaware, USA",

  /** Where disputes are resolved. */
  jurisdiction: "TODO — e.g. the courts of London, England",

  /** Contact addresses for legal + privacy requests. Use real, monitored inboxes. */
  contactEmail: "TODO — hello@yourdomain.com",
  privacyEmail: "TODO — privacy@yourdomain.com",

  /** Public site origin (used in policy text + links). Falls back to env. */
  siteUrl:
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://mazi.social",

  /** Minimum age to use the service. 13 satisfies US COPPA; some EU states require 16. */
  minimumAge: 13,

  /** Last time the policies were updated. Update whenever you change them. */
  effectiveDate: "May 31, 2026",

  /**
   * Third parties that process personal data on your behalf. Keep this list
   * accurate — it must be disclosed in the Privacy Policy.
   */
  subprocessors: [
    {
      name: "Supabase",
      purpose:
        "Authentication, database hosting, and file storage (your account, posts, and images)",
      site: "https://supabase.com/privacy",
    },
  ],
} as const;

export type LegalConfig = typeof legal;
