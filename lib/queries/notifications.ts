import { createClient } from "@/lib/supabase/server";
import type {
  Community,
  Notification,
  NotificationWithActor,
  Profile,
} from "@/lib/types/database";

export async function getNotifications(
  userId: string
): Promise<NotificationWithActor[]> {
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !rows?.length) return [];

  const actorIds = [
    ...new Set(
      rows
        .map((r) => r.actor_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ];
  const communityIds = [
    ...new Set(
      rows
        .map((r) => r.community_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ];

  const [actorsRes, communitiesRes] = await Promise.all([
    actorIds.length > 0
      ? supabase.from("profiles").select("*").in("id", actorIds)
      : Promise.resolve({ data: [] as Profile[] }),
    communityIds.length > 0
      ? supabase
          .from("communities")
          .select("id, name, slug")
          .in("id", communityIds)
      : Promise.resolve({ data: [] as Pick<Community, "id" | "name" | "slug">[] }),
  ]);

  const actorMap = new Map((actorsRes.data ?? []).map((a) => [a.id, a]));
  const communityMap = new Map(
    (communitiesRes.data ?? []).map((c) => [c.id, c])
  );

  return rows.map((n) => {
    const row = n as Notification;
    return {
      ...row,
      actor: row.actor_id ? actorMap.get(row.actor_id) ?? null : null,
      community: row.community_id
        ? communityMap.get(row.community_id) ?? null
        : null,
    };
  });
}

export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);
  return count ?? 0;
}
