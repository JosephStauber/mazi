"use client";

import { useState } from "react";
import { useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { authClient } from "@/lib/auth-client";
import { legal } from "@/lib/legal/config";
import { errorMessage } from "@/lib/utils/errors";

export function SuspendedNotice({
  username,
  reason,
  since,
}: {
  username: string;
  reason: string | null;
  since: string;
}) {
  const { toast } = useToast();
  const convex = useConvex();
  const [exporting, setExporting] = useState(false);

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
          Since {new Date(since).toLocaleDateString("en-US", { dateStyle: "long" })}. While suspended you
          can&rsquo;t use Mazi.
        </p>
      </div>

      {reason && (
        <div className="rounded-[var(--radius-md)] border border-border bg-background p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Reason
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{reason}</p>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        To appeal or ask about deleting your account, email{" "}
        <a href={`mailto:${legal.contactEmail}`} className="font-medium text-foreground underline">
          {legal.contactEmail}
        </a>
        . You can still download a copy of your data.
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
