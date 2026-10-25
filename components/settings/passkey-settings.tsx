"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { authClient, authErrorMessage } from "@/lib/auth-client";

/** List, add, and remove the passkeys on this account. */
export function PasskeySettings() {
  const { toast } = useToast();
  const { data: passkeys, isPending } = authClient.useListPasskeys();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  async function addPasskey() {
    setAdding(true);
    const result = await authClient.passkey.addPasskey({
      name: `${navigator.platform || "Device"} passkey`,
    });
    setAdding(false);
    if (result?.error) toast(authErrorMessage(result.error, "Passkey setup was cancelled"), "error");
    else toast("Passkey added — you can use it to log in.", "success");
  }

  async function removePasskey(id: string) {
    setRemoving(id);
    const { error } = await authClient.passkey.deletePasskey({ id });
    setRemoving(null);
    if (error) toast(authErrorMessage(error), "error");
  }

  return (
    <div className="space-y-2 py-3">
      <p className="text-sm font-medium text-foreground">Passkeys</p>
      <p className="text-xs text-muted-foreground">
        Log in with your fingerprint, face, or device PIN instead of a password.
      </p>
      {!isPending && passkeys && passkeys.length > 0 && (
        <ul className="space-y-1.5">
          {passkeys.map((pk) => (
            <li
              key={pk.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate text-foreground">
                {pk.name || "Passkey"}
                <span className="ml-2 text-xs text-subtle">
                  added {new Date(pk.createdAt).toLocaleDateString()}
                </span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                loading={removing === pk.id}
                onClick={() => removePasskey(pk.id)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button variant="outline" size="sm" loading={adding} onClick={addPasskey}>
        Add a passkey
      </Button>
    </div>
  );
}
