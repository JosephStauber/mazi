import { createClient } from "@/lib/supabase/server";
import type { Reservation } from "@/lib/types/database";

/** The signed-in user's own reservation row (RLS: owner-only), or null. */
export async function getMyReservation(): Promise<Reservation | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("reservations")
    .select("*")
    .eq("profile_id", user.id)
    .maybeSingle();
  return data;
}

/** How many people the signed-in user has referred (definer RPC). */
export async function getReferralCount(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_referral_count");
  if (error || typeof data !== "number") return 0;
  return data;
}
