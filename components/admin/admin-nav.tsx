"use client";

import { usePathname } from "next/navigation";
import { Tabs } from "@/components/ui/tabs";

const ITEMS = [
  { label: "Users", href: "/admin/users" },
  { label: "Reservations", href: "/admin/reservations" },
  { label: "Audit log", href: "/admin/audit" },
];

export function AdminNav() {
  const pathname = usePathname();
  const active = ITEMS.find((i) => pathname.startsWith(i.href))?.href;
  return <Tabs items={ITEMS} activeHref={active} className="mb-8" />;
}
