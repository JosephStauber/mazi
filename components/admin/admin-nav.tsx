"use client";

import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Tabs } from "@/components/ui/tabs";
import { useAdminRole } from "@/components/admin/admin-role";

const ITEMS = [
  { label: "Users", href: "/admin/users" },
  { label: "Appeals", href: "/admin/appeals" },
  { label: "Communities", href: "/admin/communities" },
  { label: "Handles", href: "/admin/handles", owner: true },
  { label: "Reservations", href: "/admin/reservations", owner: true },
  { label: "Announcements", href: "/admin/announcements", owner: true },
  { label: "Audit log", href: "/admin/audit" },
];

export function AdminNav() {
  const pathname = usePathname();
  const role = useAdminRole();
  const openAppeals = useQuery(api.adminAppeals.openCount);
  const items = ITEMS.filter((i) => !i.owner || role === "owner").map((i) => ({
    label: i.label,
    href: i.href,
    count: i.href === "/admin/appeals" && openAppeals ? openAppeals : undefined,
  }));
  const active = items.find((i) => pathname.startsWith(i.href))?.href;
  return (
    <div className="mb-8 overflow-x-auto">
      <Tabs items={items} activeHref={active} className="min-w-max" />
    </div>
  );
}
