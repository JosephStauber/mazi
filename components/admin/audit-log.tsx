"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useConvex } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { useAdminRole } from "@/components/admin/admin-role";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { errorMessage } from "@/lib/utils/errors";

type Entry = FunctionReturnType<typeof api.admin.auditLog>["page"][number];
type Action = Entry["action"];

const LABELS: Record<Action, string> = {
  suspend: "suspended",
  unsuspend: "restored",
  grant_admin: "granted admin to",
  set_signup_mode: "set signup mode",
  reveal_email: "revealed the email of",
  reset_profile: "reset the profile of",
  appeal_accepted: "accepted the appeal of",
  appeal_rejected: "rejected the appeal of",
  community_takedown: "removed a community by",
  community_transfer: "transferred a community to",
  block_handle: "blocked a handle",
  unblock_handle: "unblocked a handle",
  announcement_sent: "sent an announcement",
};

function UserLink({ id, username }: { id: string | null; username: string }) {
  return id ? (
    <Link href={`/admin/users/${id}`} className="font-medium underline-offset-2 hover:underline">
      @{username}
    </Link>
  ) : (
    <span className="font-medium">@{username}</span>
  );
}

export function AuditEntryRow({ entry: e }: { entry: Entry }) {
  return (
    <li className="px-4 py-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-foreground">
          {e.actor_username ? (
            <UserLink id={e.actor_id} username={e.actor_username} />
          ) : (
            <span className="font-medium">System / CLI</span>
          )}{" "}
          {LABELS[e.action]}
          {e.target_username && (
            <>
              {" "}
              <UserLink id={e.target_id} username={e.target_username} />
            </>
          )}
          {e.details && <span className="text-muted-foreground"> · {e.details}</span>}
        </p>
        <time dateTime={e.created_at} className="text-xs text-muted-foreground">
          {new Date(e.created_at).toLocaleString()}
        </time>
      </div>
      {e.reason && <p className="mt-1 text-xs text-muted-foreground">“{e.reason}”</p>}
    </li>
  );
}

function toCsv(rows: Entry[]) {
  const cols = ["created_at", "action", "actor_username", "target_username", "reason", "details"] as const;
  const cell = (s: string | null) => `"${(s ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
}

export function AuditLog() {
  const params = useSearchParams();
  const router = useRouter();
  const role = useAdminRole();
  const convex = useConvex();
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  const targetId = params.get("target") as Id<"profiles"> | null;
  const actionParam = params.get("action");
  const action = actionParam && actionParam in LABELS ? (actionParam as Action) : undefined;

  const { items, firstLoad, loading, done, sentinelRef } = usePaginatedList(
    api.admin.auditLog,
    { action, targetId: targetId ?? undefined },
    30
  );

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/admin/audit${next.size ? `?${next}` : ""}`);
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const rows = await convex.query(api.admin.auditExport, { action });
      const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `mazi-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="brand text-3xl text-foreground">Audit log</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every privileged action, newest first. Entries can&rsquo;t be edited or
            deleted from the app.
          </p>
        </div>
        {role === "owner" && (
          <Button variant="outline" size="sm" loading={exporting} onClick={exportCsv}>
            Export CSV
          </Button>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label htmlFor="audit-action" className="text-muted-foreground">
          Action
        </label>
        <select
          id="audit-action"
          className="h-9 rounded-[var(--radius-md)] border border-border bg-surface px-2 text-foreground"
          value={action ?? ""}
          onChange={(e) => setParam("action", e.target.value || null)}
        >
          <option value="">All</option>
          {(Object.keys(LABELS) as Action[]).map((a) => (
            <option key={a} value={a}>
              {a.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        {targetId && (
          <button
            type="button"
            onClick={() => setParam("target", null)}
            className="rounded-full border border-border px-3 py-1 text-muted-foreground hover:text-foreground"
          >
            One user only ✕
          </button>
        )}
      </div>

      {firstLoad ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-border-strong bg-surface p-10 text-center text-muted-foreground">
          Nothing recorded{action || targetId ? " for this filter" : " yet"}.
        </div>
      ) : (
        <ol className="divide-y divide-border rounded-[var(--radius-lg)] border border-border bg-surface">
          {items.map((e) => (
            <AuditEntryRow key={e.id} entry={e} />
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
