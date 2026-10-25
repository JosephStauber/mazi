import { REASON_IDS, TIME_SLIDER } from "../../lib/reserve/config";

export type SignupMeta = {
  username?: string;
  reasons: string[];
  dailyMinutes?: number;
  referredBy?: string;
};

const REASONS = new Set<string>(REASON_IDS);

/**
 * Parse the `signupMeta` JSON a signup form attaches to the Better Auth user.
 * It is client-supplied, so everything is sanitized here: only canonical survey
 * reasons (deduped), minutes clamped to the slider range, a bounded referral
 * code. Unknown/malformed input degrades to empty values, never an error.
 */
export function parseSignupMeta(raw: unknown): SignupMeta {
  let data: Record<string, unknown> = {};
  if (typeof raw === "string" && raw.length <= 4000) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") data = parsed;
    } catch {
      /* ignore */
    }
  }

  const username =
    typeof data.username === "string" ? data.username.trim() : undefined;

  const reasons = Array.isArray(data.reasons)
    ? Array.from(
        new Set(
          data.reasons.filter(
            (r): r is string => typeof r === "string" && REASONS.has(r)
          )
        )
      )
    : [];

  let dailyMinutes: number | undefined;
  if (typeof data.dailyMinutes === "number" && Number.isFinite(data.dailyMinutes)) {
    dailyMinutes = Math.round(
      Math.min(TIME_SLIDER.max, Math.max(TIME_SLIDER.min, data.dailyMinutes))
    );
  }

  const referredBy =
    typeof data.referredBy === "string" &&
    /^[a-zA-Z0-9_]{1,64}$/.test(data.referredBy.trim())
      ? data.referredBy.trim()
      : undefined;

  return { username, reasons, dailyMinutes, referredBy };
}

const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** Random [A-Za-z0-9] string — safe for usernames and URLs. */
export function randomToken(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

/** Best-effort handle from an email/name, normalized to [a-zA-Z0-9_]{3,30}. */
export function usernameFromIdentity(email: string, name?: string | null): string {
  const raw = (name || email.split("@")[0] || "user").trim();
  let base = raw
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  if (base.length < 3) base = `u_${randomToken(8)}`;
  return base.slice(0, 30);
}
