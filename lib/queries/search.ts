import { createClient } from "@/lib/supabase/server";
import type { Profile, Community } from "@/lib/types/database";

export async function searchUsers(query: string): Promise<Profile[]> {
  if (!query || query.length < 2) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .ilike("username", `%${query}%`)
    .limit(20);

  return data ?? [];
}

export async function searchCommunities(query: string): Promise<Community[]> {
  if (!query || query.length < 2) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("communities")
    .select("*")
    .ilike("name", `%${query}%`)
    .limit(20);

  return data ?? [];
}
