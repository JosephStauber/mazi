"use client";

import { useDeferredValue, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useAdminRole } from "@/components/admin/admin-role";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { formatJoinDate } from "@/lib/utils/date";
import { errorMessage } from "@/lib/utils/errors";
import { suspendReasonSchema } from "@/lib/validators/admin";

type Community = FunctionReturnType<typeof api.adminCommunities.search>[number];

export function CommunityAdmin() {
  const role = useAdminRole();
  const [search, setSearch] = useState("");
  const term = useDeferredValue(search.trim());
  const { items, firstLoad, loading, done, sentinelRef } = usePaginatedList(
    api.adminCommunities.list,
    term ? "skip" : {},
    25
  );
  const results = useQuery(api.adminCommunities.search, term ? { query: term } : "skip");
  const rows = term ? results : firstLoad ? undefined : items;
  const [removing, setRemoving] = useState<Community | null>(null);
  const [transferring, setTransferring] = useState<Community | null>(null);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="brand text-3xl text-foreground">Communities</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Names, owners and sizes only — admins can&rsquo;t read invite-only posts from
          here. {role === "owner" ? "Removal and ownership transfer are logged." : "Owners can remove or transfer a community."}
        </p>
      </header>

      <div className="w-full max-w-sm">
        <Input
          id="admin-community-search"
          label="Search by name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete="off"
        />
      </div>

      {rows === undefined ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-border-strong bg-surface p-10 text-center text-muted-foreground">
          {term ? "No matching communities." : "No communities yet."}
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-[var(--radius-lg)] border border-border bg-surface">
          {rows.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/communities/${c.slug}`} className="font-medium text-foreground hover:underline">
                    {c.name}
                  </Link>
                  <Badge variant="outline">{c.privacy === "public" ? "public" : "invite only"}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  /{c.slug} · {c.member_count} members · created {formatJoinDate(c.created_at)} · owner{" "}
                  {c.creator_username ? (
                    <Link href={`/admin/users/${c.creator_id}`} className="underline-offset-2 hover:underline">
                      @{c.creator_username}
                    </Link>
                  ) : (
                    "deleted"
                  )}
                </p>
              </div>
              {role === "owner" && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setTransferring(c)}>
                    Transfer
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => setRemoving(c)}>
                    Remove
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {!term && !done && !firstLoad && (
        <div ref={sentinelRef} className="flex justify-center py-4 text-muted-foreground">
          {loading && <Spinner />}
        </div>
      )}

      <RemoveModal community={removing} onClose={() => setRemoving(null)} />
      <TransferModal community={transferring} onClose={() => setTransferring(null)} />
    </div>
  );
}

function RemoveModal({ community, onClose }: { community: Community | null; onClose: () => void }) {
  const { toast } = useToast();
  const takedown = useMutation(api.adminCommunities.takedown);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    setReason("");
    setConfirm("");
    setError(null);
    onClose();
  }

  async function submit() {
    if (!community) return;
    const parsed = suspendReasonSchema.safeParse(reason);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid reason");
      return;
    }
    setBusy(true);
    try {
      await takedown({ communityId: community.id as Id<"communities">, reason: parsed.data });
      toast(`${community.name} removed`, "success");
      close();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={community !== null}
      onClose={close}
      title={community ? `Remove ${community.name}?` : undefined}
      description="Deletes the community with all its posts, members and invites. This can't be undone. The owner is emailed the reason."
    >
      <div className="mt-4 space-y-4">
        <Textarea
          id="takedown-reason"
          label="Reason (shown to the owner)"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          error={error ?? undefined}
          maxLength={500}
        />
        <Input
          id="takedown-confirm"
          label={community ? `Type /${community.slug} to confirm` : undefined}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="off"
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={busy}
            disabled={!community || confirm.trim() !== `/${community.slug}`}
            onClick={submit}
          >
            Remove permanently
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function TransferModal({ community, onClose }: { community: Community | null; onClose: () => void }) {
  const { toast } = useToast();
  const transfer = useMutation(api.adminCommunities.transfer);
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    setUsername("");
    setError(null);
    onClose();
  }

  async function submit() {
    if (!community || !username.trim()) return;
    setBusy(true);
    try {
      await transfer({ communityId: community.id as Id<"communities">, username });
      toast("Ownership transferred", "success");
      close();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={community !== null}
      onClose={close}
      title={community ? `Transfer ${community.name}` : undefined}
      description="The new owner must already be a member. The current owner becomes a regular member."
    >
      <div className="mt-4 space-y-4">
        <Input
          id="transfer-username"
          label="New owner's handle"
          placeholder="@username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          error={error ?? undefined}
          autoComplete="off"
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button loading={busy} disabled={!username.trim()} onClick={submit}>
            Transfer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
