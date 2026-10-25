"use client";

import { useParams } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { UserDetail } from "@/components/admin/user-detail";

export default function AdminUserPage() {
  const { id } = useParams<{ id: string }>();
  return <UserDetail profileId={id as Id<"profiles">} />;
}
