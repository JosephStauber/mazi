"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { Segmented } from "@/components/admin/segmented";
import { errorMessage } from "@/lib/utils/errors";
import { blockedHandleSchema } from "@/lib/validators/admin";

export function HandlesAdmin() {
  const data = useQuery(api.adminHandles.list);
  const block = useMutation(api.adminHandles.block);
  const unblock = useMutation(api.adminHandles.unblock);
  const { toast } = useToast();
  const [handle, setHandle] = useState("");
  const [match, setMatch] = useState<"exact" | "contains">("exact");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add() {
    const parsed = blockedHandleSchema.safeParse(handle.replace(/^@/, ""));
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid handle");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await block({ handle: parsed.data, match, note: note || undefined });
      setHandle("");
      setNote("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="brand text-3xl text-foreground">Blocked handles</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Nobody can sign up with or rename to these. Existing accounts keep their
          handle — use Reset profile on the user&rsquo;s page for those.
        </p>
      </header>

      <section className="space-y-4 rounded-[var(--radius-lg)] border border-border bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Input
            id="block-handle"
            label="Handle or word"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            error={error ?? undefined}
            autoComplete="off"
          />
          <Input
            id="block-note"
            label="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
          />
          <Segmented
            label="Match type"
            value={match}
            onChange={setMatch}
            options={[
              { value: "exact", label: "Exact" },
              { value: "contains", label: "Contains" },
            ]}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            &ldquo;Contains&rdquo; blocks any handle with this text in it (for slurs).
            Its text is left out of the audit log.
          </p>
          <Button size="sm" loading={busy} onClick={add}>
            Block
          </Button>
        </div>
      </section>

      {data === undefined ? (
        <div className="flex justify-center py-10 text-muted-foreground">
          <Spinner />
        </div>
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">Your rules</h2>
            {data.rules.length === 0 ? (
              <p className="text-sm text-muted-foreground">None yet.</p>
            ) : (
              <ul className="divide-y divide-border rounded-[var(--radius-lg)] border border-border bg-surface">
                {data.rules.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="font-mono text-foreground">{r.handle}</span>
                    <span className="text-xs text-muted-foreground">{r.match}</span>
                    {r.note && <span className="truncate text-xs text-muted-foreground">— {r.note}</span>}
                    <button
                      type="button"
                      className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                      onClick={async () => {
                        try {
                          await unblock({ id: r.id as Id<"blockedHandles"> });
                        } catch (e) {
                          toast(errorMessage(e), "error");
                        }
                      }}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">Built in (exact)</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {data.built_in.map((h) => `@${h}`).join(" · ")}
            </p>
          </section>
        </>
      )}
    </div>
  );
}
