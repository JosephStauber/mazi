"use client";

import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Spinner } from "@/components/ui/spinner";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";

type Entry = FunctionReturnType<typeof api.admin.auditLog>["page"][number];

const LABELS: Record<Entry["action"], string> = {
  suspend: "suspended",
  unsuspend: "restored",
  grant_admin: "granted admin to",
  set_signup_mode: "set signup mode",
};

export function AuditLog() {
  const { items, firstLoad, loading, done, sentinelRef } = usePaginatedList(
    api.admin.auditLog,
    {},
    30
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="brand text-3xl text-foreground">Audit log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every privileged action, newest first. Entries can&rsquo;t be edited or
          deleted from the app.
        </p>
      </header>

      {firstLoad ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-border-strong bg-surface p-10 text-center text-muted-foreground">
          Nothing recorded yet.
        </div>
      ) : (
        <ol className="divide-y divide-border rounded-[var(--radius-lg)] border border-border bg-surface">
          {items.map((e) => (
            <li key={e.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-foreground">
                  <span className="font-medium">
                    {e.actor_username ? `@${e.actor_username}` : "CLI (or an erased admin)"}
                  </span>{" "}
                  {LABELS[e.action]}
                  {e.target_username && (
                    <span className="font-medium"> @{e.target_username}</span>
                  )}
                  {e.details && <span className="text-muted-foreground"> · {e.details}</span>}
                </p>
                <time dateTime={e.created_at} className="text-xs text-muted-foreground">
                  {new Date(e.created_at).toLocaleString()}
                </time>
              </div>
              {e.reason && (
                <p className="mt-1 text-xs text-muted-foreground">“{e.reason}”</p>
              )}
            </li>
          ))}
        </ol>
      )}

      {!done && !firstLoad && (
        <div ref={sentinelRef} className="flex justify-center py-4 text-muted-foreground">
          {loading && <Spinner />}
        </div>
      )}
    </div>
  );
}
