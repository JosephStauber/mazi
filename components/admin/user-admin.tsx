"use client";

import { useDeferredValue, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Tabs } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { formatJoinDate, formatRelative } from "@/lib/utils/date";
import { errorMessage } from "@/lib/utils/errors";
import { suspendReasonSchema } from "@/lib/validators/admin";

type AdminUser = FunctionReturnType<typeof api.admin.searchUsers>[number];
type Filter = "all" | "suspended";

export function UserAdmin() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [suspending, setSuspending] = useState<AdminUser | null>(null);
  const term = useDeferredValue(search.trim());

  // Live: a suspension made by another admin shows up here immediately.
  const { items, firstLoad, loading, done, sentinelRef } = usePaginatedList(
    api.admin.users,
    term ? "skip" : { filter },
    25
  );
  const results = useQuery(api.admin.searchUsers, term ? { query: term } : "skip");

  const rows = term ? results : firstLoad ? undefined : items;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="brand text-3xl text-foreground">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Find an account and suspend or restore it. Every action is recorded in
          the audit log.
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-4">
        <div className="w-full max-w-sm">
          <Input
            id="admin-user-search"
            label="Search by handle"
            placeholder="@username"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
          />
        </div>
        {!term && (
          <Tabs
            className="w-auto border-b-0"
            items={[
              { label: "All", value: "all" },
              { label: "Suspended", value: "suspended" },
            ]}
            activeValue={filter}
            onChange={(v) => setFilter(v as Filter)}
          />
        )}
      </div>

      {rows === undefined ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-border-strong bg-surface p-10 text-center text-muted-foreground">
          {term
            ? `No handles start with “${term}”.`
            : filter === "suspended"
              ? "No suspended accounts."
              : "No accounts yet."}
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-[var(--radius-lg)] border border-border bg-surface">
          {rows.map((u) => (
            <UserRow key={u.id} user={u} onSuspend={() => setSuspending(u)} />
          ))}
        </ul>
      )}

      {!term && !done && !firstLoad && (
        <div ref={sentinelRef} className="flex justify-center py-4 text-muted-foreground">
          {loading && <Spinner />}
        </div>
      )}

      <SuspendModal user={suspending} onClose={() => setSuspending(null)} />
    </div>
  );
}

function UserRow({ user, onSuspend }: { user: AdminUser; onSuspend: () => void }) {
  const { toast } = useToast();
  const unsuspend = useMutation(api.admin.unsuspendUser);
  const [busy, setBusy] = useState(false);
  const suspended = user.suspended_at !== null;

  async function restore() {
    if (!window.confirm(`Restore @${user.username}? They'll regain access immediately.`)) return;
    setBusy(true);
    try {
      await unsuspend({ profileId: user.id as Id<"profiles"> });
      toast(`@${user.username} restored`, "success");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-4 px-4 py-3">
      <Avatar src={user.avatar_url} alt={user.username} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/profile/${user.username}`}
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            @{user.username}
          </Link>
          {user.is_admin && <Badge variant="solid">admin</Badge>}
          {user.access_level === "reserved" && <Badge variant="outline">reserved</Badge>}
          {suspended && <Badge className="bg-danger text-danger-foreground">suspended</Badge>}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Joined {formatJoinDate(user.created_at)} · {user.post_count} posts ·{" "}
          {user.follower_count} followers
        </p>
        {suspended && (
          <p className="mt-1 text-xs text-muted-foreground">
            Suspended {formatRelative(user.suspended_at!)}
            {user.suspended_reason ? ` — “${user.suspended_reason}”` : ""}
          </p>
        )}
      </div>
      {suspended ? (
        <Button variant="outline" size="sm" loading={busy} onClick={restore}>
          Restore
        </Button>
      ) : (
        !user.is_admin && (
          <Button variant="outline" size="sm" onClick={onSuspend}>
            Suspend
          </Button>
        )
      )}
    </li>
  );
}

function SuspendModal({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  const { toast } = useToast();
  const suspend = useMutation(api.admin.suspendUser);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    setReason("");
    setError(null);
    onClose();
  }

  async function submit() {
    if (!user) return;
    const parsed = suspendReasonSchema.safeParse(reason);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid reason");
      return;
    }
    setBusy(true);
    try {
      await suspend({ profileId: user.id as Id<"profiles">, reason: parsed.data });
      toast(`@${user.username} suspended`, "success");
      close();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={user !== null}
      onClose={close}
      title={user ? `Suspend @${user.username}?` : undefined}
      description="They'll be locked out of Mazi until restored, but can still sign in to read this reason and download their data. Their existing posts stay up."
    >
      <div className="mt-4 space-y-4">
        <Textarea
          id="suspend-reason"
          label="Reason (shown to the user)"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          error={error ?? undefined}
          maxLength={500}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" loading={busy} onClick={submit}>
            Suspend
          </Button>
        </div>
      </div>
    </Modal>
  );
}
