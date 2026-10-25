"use client";

import { useEffect, useState } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { authClient } from "@/lib/auth-client";
import { legal } from "@/lib/legal/config";
import { errorMessage } from "@/lib/utils/errors";
import { appealSchema } from "@/lib/validators/admin";

type Suspension = NonNullable<FunctionReturnType<typeof api.account.mySuspension>>;

const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });

export function SuspendedNotice({ username, initial }: { username: string; initial: Suspension }) {
  const { toast } = useToast();
  const convex = useConvex();
  // Live: an accepted appeal or an expired suspension sends them back in.
  const live = useQuery(api.account.mySuspension);
  const s = live === undefined ? initial : live;
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (live === null) window.location.href = "/home";
  }, [live]);

  async function handleExport() {
    setExporting(true);
    try {
      const data = await convex.query(api.account.exportMyData);
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mazi-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast(errorMessage(e, "Couldn't export your data"), "error");
    } finally {
      setExporting(false);
    }
  }

  if (!s) return null;

  return (
    <div className="w-full max-w-md space-y-6 rounded-[var(--radius-lg)] border border-border bg-surface p-6">
      <div>
        <p className="brand text-2xl">
          mazi<span className="brand-dot">.</span>
        </p>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
          @{username} is suspended
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Since {fmt(s.since)}
          {s.until ? `, until ${fmt(s.until)}` : ", until our team restores it"}. While
          suspended you can&rsquo;t use Mazi.
        </p>
      </div>

      {s.reason && (
        <div className="rounded-[var(--radius-md)] border border-border bg-background p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Reason
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{s.reason}</p>
        </div>
      )}

      <Appeal appeal={s.appeal} />

      <p className="text-sm text-muted-foreground">
        You can still download a copy of your data. To delete your account, email{" "}
        <a href={`mailto:${legal.contactEmail}`} className="font-medium text-foreground underline">
          {legal.contactEmail}
        </a>
        .
      </p>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" loading={exporting} onClick={handleExport}>
          Download my data
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await authClient.signOut();
            window.location.href = "/";
          }}
        >
          Log out
        </Button>
      </div>
    </div>
  );
}

function Appeal({ appeal }: { appeal: Suspension["appeal"] }) {
  const submit = useMutation(api.account.submitAppeal);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (appeal) {
    return (
      <div className="rounded-[var(--radius-md)] border border-border bg-background p-4 text-sm">
        <p className="font-medium text-foreground">
          {appeal.status === "open"
            ? "Your appeal is waiting for review."
            : "Your appeal was reviewed and the suspension stays in place."}
        </p>
        {appeal.response && <p className="mt-1 text-muted-foreground">From our team: {appeal.response}</p>}
      </div>
    );
  }

  async function send() {
    const parsed = appealSchema.safeParse(body);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid appeal");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await submit({ body: parsed.data });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Textarea
        id="appeal-body"
        label="Think this is a mistake? Appeal (once per suspension)"
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        error={error ?? undefined}
        maxLength={1000}
      />
      <div className="flex justify-end">
        <Button size="sm" loading={busy} onClick={send}>
          Send appeal
        </Button>
      </div>
    </div>
  );
}
