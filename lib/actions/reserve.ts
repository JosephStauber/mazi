"use server";

import { headers } from "next/headers";
import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/server";
import { mapSupabaseUserMessage } from "@/lib/supabase/map-error";
import { reserveSchema } from "@/lib/validators/reserve";

export type ReserveResult =
  | { error: string }
  | {
      success: true;
      username: string;
      /** Only set once we can confirm the reservation persisted (session issued). */
      referralCode: string | null;
      /** True when Supabase requires email confirmation (no session yet). */
      needsEmailConfirmation: boolean;
    };

/** Best-effort client IP for rate-limit keying (Vercel/proxy sets these). */
async function clientKey(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip")?.trim() || "unknown";
}

/**
 * DB-backed throttle with server-fixed limits (the RPC picks max/window by
 * action; callers can't). Defense-in-depth for the funnel path only — Supabase
 * Auth's own rate limits + a CAPTCHA are the real control for direct calls.
 * Fails OPEN.
 */
async function underLimit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  action: "reserve" | "username_check",
  key: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("rate_limit_hit", {
    p_action: action,
    p_key: key,
  });
  if (error) return true; // fail open (e.g. migration not yet applied)
  return data !== false;
}

/** Live availability for the funnel's username field (anon-callable RPC). */
export async function checkUsername(
  username: string
): Promise<{ available: boolean }> {
  const trimmed = username.trim();
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(trimmed)) return { available: false };

  const supabase = await createClient();
  const ok = await underLimit(supabase, "username_check", await clientKey());
  if (!ok) return { available: false };

  const { data, error } = await supabase.rpc("username_available", {
    p_username: trimmed,
  });
  if (error) return { available: false };
  return { available: data === true };
}

/**
 * Reserve a username pre-launch. Creates a real Supabase account carrying
 * reservation metadata; the `handle_new_user` trigger marks the profile
 * `reserved` (per DB config) and records the survey + referral atomically.
 *
 * We only assert the reservation persisted (return the referral code) when a
 * session is issued — with anti-enumeration/confirmation on, a "no error"
 * signUp can be a phantom, so we fall back to a generic "check your inbox".
 */
export async function reserve(input: unknown): Promise<ReserveResult> {
  const parsed = reserveSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { email, username, password, reasons, dailyMinutes, referredBy } =
    parsed.data;

  const supabase = await createClient();

  const ok = await underLimit(supabase, "reserve", await clientKey());
  if (!ok) {
    return { error: "Too many attempts from your network. Please try again later." };
  }

  // Friendly message for the common taken case. The DB unique index +
  // trigger de-dup are the real race guards.
  const { data: available } = await supabase.rpc("username_available", {
    p_username: username,
  });
  if (available === false) {
    return { error: "That username is already reserved. Try another." };
  }

  const referralCode = nanoid(10);
  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // PKCE: the emailed link hits our callback, which exchanges the code
      // for a session, then forwards to /welcome.
      emailRedirectTo: origin
        ? `${origin}/auth/callback?next=/welcome`
        : undefined,
      data: {
        username,
        reasons,
        daily_social_minutes: dailyMinutes,
        referred_by: referredBy ?? null,
        referral_code: referralCode,
      },
    },
  });

  if (error) {
    return { error: mapSupabaseUserMessage(error.message) };
  }

  // No session ⇒ confirmation required (or an anti-enumeration phantom). Don't
  // claim persistence: return generic state, no referral link yet.
  if (!data.session) {
    return {
      success: true,
      username,
      referralCode: null,
      needsEmailConfirmation: true,
    };
  }

  // Session issued ⇒ the account + reservation really exist. Return the ACTUAL
  // persisted username (the trigger may have de-duped a race-lost handle).
  let finalUsername = username;
  const { data: prof } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", data.user!.id)
    .maybeSingle();
  if (prof?.username) finalUsername = prof.username;

  return {
    success: true,
    username: finalUsername,
    referralCode,
    needsEmailConfirmation: false,
  };
}
