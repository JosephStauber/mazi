import { createClient } from "@/lib/supabase/server";

export type ReservationStats = {
  total: number;
  today: number;
  last7: number;
  last30: number;
  confirmed: number;
  customized: number;
  referred: number;
  avg_minutes: number | null;
  median_minutes: number | null;
  sum_minutes: number;
  reasons: Record<string, number>;
  daily: { day: string; count: number }[];
  minute_buckets: { label: string; count: number }[];
  top_referrers: { username: string; count: number }[];
};

export type ReservationRow = {
  username: string;
  email: string;
  email_confirmed: boolean;
  reasons: string[];
  daily_social_minutes: number | null;
  referral_code: string;
  referred_by: string | null;
  referral_count: number;
  bio_set: boolean;
  avatar_set: boolean;
  created_at: string;
};

/** Whether the signed-in user is on the admin allowlist (definer RPC). */
export async function getIsAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_admin");
  return !error && data === true;
}

/** Aggregate dashboard metrics (admin-guarded RPC). Null if not authorized. */
export async function getReservationStats(): Promise<ReservationStats | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_reservation_stats");
  if (error || !data) return null;
  return data as ReservationStats;
}

/**
 * Per-signup rows incl. emails (admin-guarded RPC). Returns `null` on error so
 * the UI can distinguish "failed to load" from "no reservations yet".
 * Capped at RESERVATION_LIST_LIMIT (see lib/reserve/config).
 */
export async function getReservationList(): Promise<ReservationRow[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_reservation_list");
  if (error) return null;
  return (data as ReservationRow[]) ?? [];
}
