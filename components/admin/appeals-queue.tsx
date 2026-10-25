"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { Segmented } from "@/components/admin/segmented";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { formatRelative } from "@/lib/utils/date";
import { errorMessage } from "@/lib/utils/errors";
import { appealResponseSchema } from "@/lib/validators/admin";

type Appeal = FunctionReturnType<typeof api.adminAppeals.list>["page"][number];
type Status = Appeal["status"];

export function AppealsQueue() {
  const [status, setStatus] = useState<Status>("open");
  const { items, firstLoad, loading, done, sentinelRef } = usePaginatedList(
    api.adminAppeals.list,
    { status },
    20
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="brand text-3xl text-foreground">Appeals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Suspended users can appeal once per suspension. Accepting restores the
            account; either way the user is emailed, with your reply if you add one.
          </p>
        </div>
        <Segmented
          label="Appeal status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "open", label: "Open" },
            { value: "accepted", label: "Accepted" },
            { value: "rejected", label: "Rejected" },
          ]}
        />
      </header>

      {firstLoad ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-border-strong bg-surface p-10 text-center text-muted-foreground">
          {status === "open" ? "No open appeals." : `No ${status} appeals.`}
        </div>
      ) : (
        <ul className="space-y-4">
          {items.map((a) => (
            <AppealCard key={a.id} appeal={a} />
          ))}
        </ul>
      )}

      {!done && !firstLoad && (
        <div ref={sentinelRef} className="flex justify-center py-4 text-muted-foreground">
          {loading && <Spinner />}
        </div>
      )}
    </div>
  );
}

function AppealCard({ appeal: a }: { appeal: Appeal }) {
  const { toast } = useToast();
  const resolve = useMutation(api.adminAppeals.resolve);
  const [response, setResponse] = useState("");
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null);

  async function decide(accept: boolean) {
    const parsed = appealResponseSchema.safeParse(response);
    if (!parsed.success) {
      toast(parsed.error.issues[0]?.message ?? "Invalid reply", "error");
      return;
    }
    setBusy(accept ? "accept" : "reject");
    try {
      await resolve({ appealId: a.id as Id<"appeals">, accept, response: parsed.data });
      toast(accept ? "Appeal accepted — account restored" : "Appeal rejected", "success");
    } catch (e) {
      toast(errorMessage(e), "error");
      setBusy(null);
    }
  }

  return (
    <li className="space-y-3 rounded-[var(--radius-lg)] border border-border bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        {a.username ? (
          <Link href={`/admin/users/${a.profile_id}`} className="font-medium text-foreground hover:underline">
            @{a.username}
          </Link>
        ) : (
          <span className="text-muted-foreground">deleted account</span>
        )}
        <span className="text-xs text-muted-foreground">
          appealed {formatRelative(a.created_at)}
          {a.resolved_at ? ` · resolved ${formatRelative(a.resolved_at)}` : ""}
        </span>
      </div>
      {a.suspended_reason && (
        <p className="text-xs text-muted-foreground">Suspended for: “{a.suspended_reason}”</p>
      )}
      <p className="whitespace-pre-wrap text-sm text-foreground">{a.body}</p>
      {a.status === "open" ? (
        <>
          <Textarea
            id={`appeal-reply-${a.id}`}
            rows={2}
            placeholder="Optional reply (emailed to the user)"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            maxLength={1000}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" loading={busy === "reject"} disabled={!!busy} onClick={() => decide(false)}>
              Reject
            </Button>
            <Button size="sm" loading={busy === "accept"} disabled={!!busy} onClick={() => decide(true)}>
              Accept &amp; restore
            </Button>
          </div>
        </>
      ) : (
        a.response && <p className="text-sm text-muted-foreground">Reply: {a.response}</p>
      )}
    </li>
  );
}
