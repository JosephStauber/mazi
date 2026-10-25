"use client";

import { createContext, useContext, type ReactNode } from "react";

export type AdminRole = "owner" | "moderator";

const AdminRoleContext = createContext<AdminRole>("moderator");

/** The viewer's admin role, for hiding UI. The server re-checks every action. */
export function AdminRoleProvider({ role, children }: { role: AdminRole; children: ReactNode }) {
  return <AdminRoleContext.Provider value={role}>{children}</AdminRoleContext.Provider>;
}

export function useAdminRole() {
  return useContext(AdminRoleContext);
}

/** Renders children for owners; a short note for moderators. */
export function OwnerOnly({ children }: { children: ReactNode }) {
  if (useAdminRole() !== "owner") {
    return (
      <div className="rounded-[var(--radius-lg)] border border-dashed border-border-strong bg-surface p-10 text-center text-muted-foreground">
        This page is for owners only.
      </div>
    );
  }
  return <>{children}</>;
}
